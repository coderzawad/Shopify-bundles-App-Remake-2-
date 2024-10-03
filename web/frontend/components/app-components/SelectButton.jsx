import { Button, ResourceList, ResourceItem, TextStyle, Thumbnail, Stack, Card } from "@shopify/polaris";
import { useState, useCallback } from "react";
import { ResourcePicker } from "@shopify/app-bridge-react";

function ProductSelectButton({ onProductSelect }) {  
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [isButtonVisible, setButtonVisible] = useState(true);

  const handleSelection = useCallback((resources) => {
    const products = resources.selection.map((product) => ({
      id: product.id,
      title: product.title,
      imageSrc: product.images[0]?.originalSrc || '',  // Get product image
      price: product.variants[0]?.price || 'N/A',      // Get product price
    }));
  
    // Combine the previous and newly selected products
    const updatedSelectedProducts = [...selectedProducts, ...products];
    
    // Update the local state
    setSelectedProducts(updatedSelectedProducts);
    
    // Close the picker
    setPickerOpen(false);
    
    // Pass the updated products and count to the parent
    onProductSelect(updatedSelectedProducts.length, updatedSelectedProducts);
  }, [onProductSelect, selectedProducts]);
  

  return (
    <div>
      {/* Show text only if no products are selected */}
      {selectedProducts.length === 0 ? (
        <div>
          <p>Select the products you want to bundle.</p>
          <Button
            onClick={() => {
              setPickerOpen(true);
              setButtonVisible(false);
            }}
          >
            Select products
          </Button>
        </div>
      ) : (
        <Card
          title={
            <Stack alignment="center">
              <span>Selected Products</span>
              <Button plain onClick={() => setPickerOpen(true)}>
                Add products
              </Button>
            </Stack>
          }
        >
          <ResourceList
            resourceName={{ singular: 'product', plural: 'products' }}
            items={selectedProducts}
            renderItem={(product) => {
              const { id, title, imageSrc, price } = product;
              const media = <Thumbnail source={imageSrc || ''} alt={title} />;

              return (
                <ResourceItem
                  id={id}
                  media={media}
                  accessibilityLabel={`View details for ${title}`}
                >
                  <Stack vertical>
                    <h3>
                      <TextStyle variation="strong">{title}</TextStyle>
                    </h3>
                    <div>{`Price: $${price}`}</div>
                  </Stack>
                </ResourceItem>
              );
            }}
          />
        </Card>
      )}
      
      <ResourcePicker
        resourceType="Product"
        showVariants={false}
        open={pickerOpen}
        onSelection={handleSelection}
        onCancel={() => setPickerOpen(false)}
      />
    </div>
  );
}

export default ProductSelectButton;
