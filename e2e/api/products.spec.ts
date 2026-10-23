import { test, expect } from '@playwright/test';

// Each step depends on the product created in the create step
test.describe.configure({ mode: 'serial' });

const PRODUCTS = '/api/products';

let productId: number;

test('list returns seeded products', async ({ request }) => {
  const res = await request.get(PRODUCTS);
  expect(res.ok()).toBeTruthy();

  const products = await res.json();
  expect(Array.isArray(products)).toBeTruthy();
  expect(products.length).toBeGreaterThan(0);
});

test('search by name returns a list', async ({ request }) => {
  const res = await request.get(`${PRODUCTS}?q=keyboard`);
  expect(res.ok()).toBeTruthy();
  expect(Array.isArray(await res.json())).toBeTruthy();
});

test('create returns an id', async ({ request }) => {
  const res = await request.post(PRODUCTS, {
    data: {
      name: 'E2E product',
      description: 'created by CI',
      price: 9.99,
      stock: 3,
      imageUrl: 'https://example.com/e2e.jpg',
    },
  });
  expect(res.status()).toBe(201);

  const created = await res.json();
  expect(created.id).toBeTruthy();
  productId = created.id;
});

test('read returns the created name', async ({ request }) => {
  const res = await request.get(`${PRODUCTS}/${productId}`);
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).name).toBe('E2E product');
});

test('update changes the name', async ({ request }) => {
  const res = await request.put(`${PRODUCTS}/${productId}`, {
    data: {
      name: 'E2E product updated',
      description: 'updated by CI',
      price: 19.99,
      stock: 5,
      imageUrl: 'https://example.com/e2e.jpg',
    },
  });
  expect(res.ok()).toBeTruthy();

  const read = await request.get(`${PRODUCTS}/${productId}`);
  expect((await read.json()).name).toBe('E2E product updated');
});

test('delete removes the product, then GET returns 404', async ({ request }) => {
  const del = await request.delete(`${PRODUCTS}/${productId}`);
  expect(del.ok()).toBeTruthy();

  const res = await request.get(`${PRODUCTS}/${productId}`);
  expect(res.status()).toBe(404);
});
