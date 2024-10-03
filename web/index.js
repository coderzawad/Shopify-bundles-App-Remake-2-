import { join } from "path";
import { readFileSync } from "fs";
import express from "express";
import serveStatic from "serve-static";
import mongoose from "mongoose";
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import shopify from "./shopify.js";
import productCreator from "./product-creator.js";
import GDPRWebhookHandlers from "./gdpr.js";

const PORT = parseInt(
  process.env.BACKEND_PORT || process.env.PORT || "3000",
  10
);

const openDb = async () => {
  return open({
    filename: '../web/frontend/database/feedback.db',
    driver: sqlite3.Database
  }); 
};

const STATIC_PATH =
  process.env.NODE_ENV === "production"
    ? `${process.cwd()}/frontend/dist`
    : `${process.cwd()}/frontend/`;

const app = express();

// Set up Shopify authentication and webhook handling
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: GDPRWebhookHandlers })
);

// If you are adding routes outside of the /api path, remember to
// also add a proxy rule for them in web/frontend/vite.config.js

app.use("/api/*", shopify.validateAuthenticatedSession());

app.use(express.json());

// Database connection
mongoose
  .connect(`${process.env.DB_URL}+${process.env.DB_NAME}`)
  .then(() => console.log("db connected"))
  .catch((err) => console.log(err, "error not connected"));
// ------------------

app.get("/api/products/count", async (_req, res) => {
  const countData = await shopify.api.rest.Product.count({
    session: res.locals.shopify.session,
  });
  res.status(200).send(countData);
});

app.get("/api/products/create", async (_req, res) => {
  let status = 200;
  let error = null;

  try {
    await productCreator(res.locals.shopify.session);
  } catch (e) {
    console.log(`Failed to process products/create: ${e.message}`);
    status = 500;
    error = e.message;
  }
  
  res.status(status).send({ success: status === 200, error });
});

app.post("/api/save-bundle", async (req, res) => {
  const { title, price, selectedProducts } = req.body;

  if (!title || !Array.isArray(selectedProducts) || selectedProducts.length === 0) {
    return res.status(400).json({ message: "Invalid data" });
  }

  try {
    const session = res.locals.shopify.session;
    const client = new shopify.clients.Graphql({session});

    // Fetch full details for each product
    const productDetailsQuery = `
      query getProductDetails($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            options {
              id
              name
              values
            }
            variants(first: 1) {
              edges {
                node {
                  id
                }
              }
            }
          }
        }
      }
    `;

    const productIds = selectedProducts.map(p => `gid://shopify/Product/${p.id}`);
    const productDetailsResponse = await client.query({
      data: {
        query: productDetailsQuery,
        variables: { ids: productIds }
      }
    });

    const fullProductDetails = productDetailsResponse.body.data.nodes;

    // Construct the components array for the GraphQL mutation
    const components = fullProductDetails.map(product => ({
      quantity: 1,
      productId: product.id,
      optionSelections: product.options.map(option => ({
        componentOptionId: option.id,
        name: option.name,
        values: [option.values[0]] // Selecting the first option value
      }))
    }));

    // Construct the GraphQL mutation
    const mutation = `
      mutation productBundleCreate($input: ProductBundleCreateInput!) {
        productBundleCreate(input: $input) {
          productBundleOperation {
            id
            status
          }
          userErrors {
            message
            field
          }
        }
      }
    `;

    const response = await client.query({
      data: {
        query: mutation,
        variables: {
          input: {
            title: title,
            components: components
          }
        }
      }
    });

    const result = response.body.data.productBundleCreate;

    if (result.userErrors.length > 0) {
      throw new Error(result.userErrors[0].message);
    }

    const operationId = result.productBundleOperation.id;

     const pollForStatus = async () => {
      const statusQuery = `
        query {
          productBundleOperation(id: "${operationId}") {
            status
            productId
          }
        }
      `;

      const statusResponse = await client.query({
        data: { query: statusQuery }
      });

      const operation = statusResponse.body.data.productBundleOperation;

      if (operation.status === 'COMPLETED') {
        const productId = operation.productId.split('/').pop();
        const shopSubdomain = session.shop.split(".")[0];
        const productEditUrl = `https://admin.shopify.com/store/${shopSubdomain}/products/${productId}`;

        await shopify.api.rest.Product.update(session, {
          id: productId,
          variants: [{ price: price }]
        });

        res.status(200).json({
          message: "Bundle created successfully",
          productId: productId,
          productEditUrl: productEditUrl
        });
      } else if (operation.status === 'FAILED') {
        throw new Error('Bundle creation failed');
      } else {
        setTimeout(pollForStatus, 1000);
      }
    };

    // Start polling for status
    pollForStatus();

  } catch (e) {
    console.log("Error creating bundle:", e);
    res.status(500).json({ message: "Failed to create bundle", error: e.message });
  }
});
app.get("/api/get-bundles", async (req, res) => {
  try {
    const session = res.locals.shopify.session;

    const bundles = await shopify.api.rest.Product.all({
      session,
      params: { tagged_with: "bundle" }, // Fetch products that has the bundle tagg
    });

    res.status(200).json({ bundles });
  } catch (error) {
    console.error("Error fetching bundles:", error);
    res.status(500).json({ error: "Failed to fetch bundles" });
  }
});

// Savibg tge feedback into feedback.db database
app.post('/api/feedback', async (req, res) => {
  const { type } = req.body;

  if (!type || !['good', 'bad'].includes(type)) {
    return res.status(400).json({ message: 'Invalid feedback type' });
  }

  try {
    const db = await openDb();
    await db.run('INSERT INTO feedback (type) VALUES (?)', [type]);
    await db.close();
    res.status(200).json({ message: 'Feedback saved successfully' });
  } catch (error) {
    console.error('Error saving feedback:', error);
    res.status(500).json({ message: 'Failed to save feedback', error: error.message });
  }
});

app.use(shopify.cspHeaders());
app.use(serveStatic(STATIC_PATH, { index: false }));

app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(readFileSync(join(STATIC_PATH, "index.html")));
});

app.listen(PORT);