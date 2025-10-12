import { test, expect } from '@playwright/test';

test('homepage loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Tsukkomi V2/);
  await expect(page.locator('text=Tsukkomi — 今日のお題')).toBeVisible();
});

test('login page loads', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveTitle(/Tsukkomi V2/);
  await expect(page.locator('text=ログイン（開発用）')).toBeVisible();
});

test('select HS user', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('text=HS')).toBeVisible();
  
  // Find the button next to HS user name
  const hsUserContainer = page.locator('text=HS').locator('xpath=ancestor::li');
  const selectButton = hsUserContainer.locator('button:has-text("選択")');
  await selectButton.click();
  
  await expect(page).toHaveURL('/');
  
  // Check that HS is displayed in the header
  await expect(page.locator('nav[aria-label="Main"] span:has-text("HS")').first()).toBeVisible();
});

test('switch to test sub-user', async ({ page }) => {
  // First select HS user
  await page.goto('/login');
  const hsUserContainer = page.locator('text=HS').locator('xpath=ancestor::li');
  const selectButton = hsUserContainer.locator('button:has-text("選択")');
  await selectButton.click();
  await expect(page).toHaveURL('/');

  // Go back to login page and switch to test sub-user
  await page.goto('/login');
  
  // Open HS user details
  const hsDetailsButton = hsUserContainer.locator('button:has-text("詳細")');
  await hsDetailsButton.click();
  
  // Click on test sub-user switch button
  await page.locator('text=test').locator('xpath=following-sibling::button').click();
  
  await expect(page).toHaveURL('/');
  
  // Check that test is displayed in the header
  await expect(page.locator('nav[aria-label="Main"] span:has-text("test")').first()).toBeVisible();
});

test('open topics page', async ({ page }) => {
  await page.goto('/topics');
  await expect(page).toHaveTitle(/Tsukkomi V2/);
  await expect(page.locator('text=お題一覧')).toBeVisible();
});

test('search and open topic', async ({ page }) => {
  // Switch to test user first
  await page.goto('/login');
  const hsUserContainer = page.locator('text=HS').locator('xpath=ancestor::li');
  const selectButton = hsUserContainer.locator('button:has-text("選択")');
  await selectButton.click();
  await page.goto('/login');
  const hsDetailsButton = hsUserContainer.locator('button:has-text("詳細")');
  await hsDetailsButton.click();
  await page.locator('text=test').locator('xpath=following-sibling::button').click();
  await expect(page.locator('nav[aria-label="Main"] span:has-text("test")').first()).toBeVisible();

  await page.goto('/topics');
  
  // Check that search form is present
  await expect(page.locator('input[name="q"]')).toBeVisible();
  await expect(page.locator('button:has-text("検索")')).toBeVisible();
  
  // Enter a search query
  const searchQuery = '「学生ロボットコンテスト」のテレビ欄。なんじゃそれ！何と書かれていた？';
  await page.fill('input[name="q"]', searchQuery);
  
  // Click search button
  await page.click('button:has-text("検索")');
  
  // Check that the page still loads (search executed)
  await expect(page.locator('text=お題一覧')).toBeVisible();
  
  // Check that the search query is in the URL
  await expect(page).toHaveURL(new RegExp(`q=${encodeURIComponent(searchQuery)}`));
  
  // Wait for search results to load
  await page.waitForTimeout(1000);
  
  // Try to find and click the topic link
  const topicLink = page.locator('a[aria-label*="お題"]').first();
  if (await topicLink.isVisible()) {
    await topicLink.click();
    
    // Check that we're on a topic detail page
    await expect(page).toHaveURL(/\/topics\/\d+/);
    
    // Wait for the page to load
    await page.waitForTimeout(1000);
    
    // Sort by oldest
    await page.selectOption('select[name="sortBy"]', 'oldest');
    
    // Click search button to submit the form and apply sorting
    await page.click('button:has-text("検索")');
    
    // Wait for URL to update with sortBy parameter
    await page.waitForURL((url) => url.searchParams.has('sortBy'), { timeout: 5000 });
    
    // Check if sortBy parameter was added to URL
    const finalURL = page.url();
    const hasSortParam = finalURL.includes('sortBy=oldest');
    
    // Expect sortBy=oldest to be in the URL after form submission
    expect(hasSortParam).toBe(true);
  } else {
    console.log('No topic found in search results');
  }
});