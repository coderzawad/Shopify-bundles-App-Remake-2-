import {
  Page,
  ResourceList,
  ResourceItem,
  Button,
  TextStyle,
  Stack,
  Card,
  ButtonGroup,
  Toast,
  Frame,
  Icon,
  Banner
} from "@shopify/polaris";
import { ThumbsUpMajor, ThumbsDownMajor } from "@shopify/polaris-icons";
import { useNavigate, Link } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { useAuthenticatedFetch } from "@shopify/app-bridge-react";
import { CirclePlusMinor, ViewMinor } from '@shopify/polaris-icons';

// Merge Sort Function
const mergeSort = (array, key) => {
  if (array.length <= 1) return array;

  const middle = Math.floor(array.length / 2);
  const left = array.slice(0, middle);
  const right = array.slice(middle);

  return merge(mergeSort(left, key), mergeSort(right, key), key);
};

const merge = (left, right, key) => {
  let result = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    const leftPrice = parseFloat(left[leftIndex].variants[0]?.price || 0);
    const rightPrice = parseFloat(right[rightIndex].variants[0]?.price || 0);

    if (leftPrice > rightPrice) {
      result.push(left[leftIndex]);
      leftIndex++;
    } else {
      result.push(right[rightIndex]);
      rightIndex++;
    }
  }

  return result.concat(left.slice(leftIndex)).concat(right.slice(rightIndex));
}; // Using the merge sort cause javascript perfomance is dog shit...

function BundlePage() {
  const [bundles, setBundles] = useState([]);
  const fetch = useAuthenticatedFetch();
  const navigate = useNavigate();
  const [showToast, setShowToast] = useState(false);  // State for toast visibility
  const [toastMessage, setToastMessage] = useState("")
  
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await fetch("/api/get-bundles");
        if (response.ok) {
          const data = await response.json();
          const bundleProducts = data.bundles.data.filter(
            (product) => product.tags && product.tags.includes("bundle")
          );
          setBundles(bundleProducts);
        }
      } catch (error) {
        console.error("Error fetching products:", error);
      }
    }; // Fetch products and filters the object that is returned from the backend body (Will implement a better way later)
    fetchProducts();
  }, [fetch]); 

  // Sort bundles by price (higher to lower)
  const sortedBundles = mergeSort(bundles, 'price');

  const resourceName = {
    singular: "bundle",
    plural: "bundles",
  };

  const handleViewInProductList = () => {
    const shopUrl = `https://${atob(
      new URLSearchParams(location.search).get("host")
    )}`;
    const url = `${shopUrl}/products?tag=bundle`;
    window.open(url, "_blank");
  };

  // Submit feedback to the backend
  const submitFeedback = async (type) => {
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit feedback");
      }

      // Show custom toast message based on feedback type
      const message = type === "good" ? "Thanks for your positive feedback! 😊" : "Thanks for your feedback, we’ll work on it! 👷‍♂️";
      setToastMessage(message);
      setShowToast(true);  // Display the toast
    } catch (error) {
      console.error("Error submitting feedback:", error);
      alert("Failed to submit feedback. Please try again later.");
    }
  };

  return (
    <Page title="Bundles" divider>
      {/* Buttons for Actions */}
      <div
  style={{
    display: "flex",
    justifyContent: "flex-end",
    margin: "16px 0",
  }}
>
  <ButtonGroup>
    <Button
    plain
      icon={ViewMinor}
      onClick={handleViewInProductList}
    >
      View in product list
    </Button>
    <Link to="/app-new-bundle" style={{ textDecoration: "none" }}>
      <Button
        primary
        icon={CirclePlusMinor}
      >
        Create bundle
      </Button>
    </Link>
  </ButtonGroup>
</div>

      {/* Display Bundles */}
      <Card title="Bundle Products" sectioned>
        {sortedBundles.length > 0 ? (
          <ResourceList
            resourceName={resourceName}
            items={sortedBundles}
            renderItem={(item) => {
              const { id, title, variants } = item;
              const price =
                variants && variants.length > 0
                  ? variants[0].price
                  : "No price available";
              return (
                <ResourceItem id={id}>
                  <Stack distribution="equalSpacing" alignment="center">
                    <Stack.Item fill>
                      <TextStyle variation="strong">{title}</TextStyle>
                    </Stack.Item>
                    <Stack.Item>
                      <TextStyle variation="subdued">
                        ৳{parseFloat(price).toFixed(2)}
                      </TextStyle>
                    </Stack.Item>
                  </Stack>
                </ResourceItem>
              );
            }}
          />
        ) : (
          <Banner status="info" title="Nothing to show" />
        )}
      </Card>

      {/* Feedback Section */}
      <Card title="Share your feedback" sectioned>
  <p>How would you describe your experience using the Shopify Bundles app?</p>
  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
    <Button
      icon={ThumbsUpMajor} // Use the Polaris icon for thumbs up
      plain
      className="Polaris-Button Polaris-Button--pressable Polaris-Button--sizeMedium Polaris-Button--textAlignCenter"
      onClick={() => submitFeedback("good")}
    >
      Good
    </Button>
    <Button
      icon={ThumbsDownMajor} // Use the Polaris icon for thumbs down
      plain
      className="Polaris-Button Polaris-Button--pressable Polaris-Button--sizeMedium Polaris-Button--textAlignCenter"
      onClick={() => submitFeedback("bad")}
    >
      Bad
    </Button>
  </div>
</Card>

      <div style={{ textAlign: "center", marginTop: "20px" }}>
        <a href="https://help.shopify.com/manual/products/bundles" style={{ textDecoration: "none", color: "#5c6ac4" }}>
          Learn more about creating bundles
        </a>
      </div>

      {/* Toast for feedback */}
      {showToast && (
        <Frame>
          <Toast content={toastMessage} onDismiss={() => setShowToast(false)} />
        </Frame>
      )}
    </Page>
  );
}

export default BundlePage;
