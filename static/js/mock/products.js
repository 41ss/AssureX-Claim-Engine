/**
 * mock/products.js — registered products & warranty records for the
 * Products & Warranty page. The platform team owns registration and
 * warranty-expiry calculations; this is demonstration data only.
 */

export const MOCK_PRODUCTS = [
  {
    id: "PRD-2001",
    name: "Dell XPS 15",
    type: "laptop",
    brand: "Dell",
    model: "XPS 15 9530",
    serialNumber: "SN12345678",
    purchaseDate: "2024-03-12",
    purchasePrice: 185000,
    retailer: "Dell Kenya Online Store",
    warranty: { provider: "Dell Premium Care", start: "2024-03-12", expiry: "2027-03-12", status: "active" },
    claimHistory: ["CLM-0012847"],
  },
  {
    id: "PRD-2002",
    name: "iPhone 15",
    type: "phone",
    brand: "Apple",
    model: "iPhone 15",
    serialNumber: "SN98765432",
    purchaseDate: "2025-01-20",
    purchasePrice: 142000,
    retailer: "iStore Nairobi",
    warranty: { provider: "Apple Care", start: "2025-01-20", expiry: "2027-01-20", status: "active" },
    claimHistory: ["CLM-0012846"],
  },
  {
    id: "PRD-2003",
    name: "Samsung QLED TV",
    type: "appliance",
    brand: "Samsung",
    model: "QN55Q60C",
    serialNumber: "SN30044211",
    purchaseDate: "2024-11-15",
    purchasePrice: 98000,
    retailer: "Samsung Experience Store",
    warranty: { provider: "Samsung Care+", start: "2024-11-15", expiry: "2026-11-15", status: "expiring" },
    claimHistory: ["CLM-0012790", "CLM-0012842"],
  },
  {
    id: "PRD-2004",
    name: "Toyota RAV4",
    type: "vehicle",
    brand: "Toyota",
    model: "RAV4 2023",
    serialNumber: "VIN2023RAV4X",
    purchaseDate: "2023-06-10",
    purchasePrice: 4200000,
    retailer: "Toyota Kenya",
    warranty: { provider: "Toyota Assure", start: "2023-06-10", expiry: "2028-06-10", status: "active" },
    claimHistory: ["CLM-0012844"],
  },
  {
    id: "PRD-2005",
    name: "Sony WH-1000XM5",
    type: "phone",
    brand: "Sony",
    model: "WH-1000XM5",
    serialNumber: "SN90211456",
    purchaseDate: "2025-04-01",
    purchasePrice: 39500,
    retailer: "Jumia Kenya",
    warranty: { provider: "Sony Warranty", start: "2025-04-01", expiry: "2026-04-01", status: "expired" },
    claimHistory: ["CLM-0012839"],
  },
  {
    id: "PRD-2006",
    name: "MacBook Air M2",
    type: "laptop",
    brand: "Apple",
    model: "MacBook Air M2",
    serialNumber: "SN66123890",
    purchaseDate: "2024-02-18",
    purchasePrice: 168000,
    retailer: "iStore Nairobi",
    warranty: { provider: "Apple Care", start: "2024-02-18", expiry: "2026-02-18", status: "expired" },
    claimHistory: ["CLM-0012841"],
  },
];

export function getProductById(id) {
  return MOCK_PRODUCTS.find((p) => p.id === id);
}
