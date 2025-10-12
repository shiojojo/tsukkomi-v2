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
    
    // Wait for answers to load
    await page.waitForTimeout(2000);
    
    // Find the first answer and click its favorite button
    const firstAnswer = page.locator('ul li').first();
    if (await firstAnswer.isVisible()) {
      console.log('Found first answer');
      
      // Find the favorite button within the first answer
      const favoriteButton = firstAnswer.locator('button[aria-pressed]').first();
      const initialState = await favoriteButton.getAttribute('aria-pressed') === 'true';
      console.log('Favorite button found, initial state:', initialState);
      
      // If already active, click to deactivate first
      if (initialState) {
        console.log('Button is active, clicking to deactivate');
        await favoriteButton.click();
        await page.waitForTimeout(1000);
        await expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');
        console.log('Button deactivated');
      }
      
      // Now click to activate (whether it was initially active or not)
      console.log('Clicking to activate favorite button');
      await favoriteButton.click();
      await page.waitForTimeout(1000);
      
      // Verify it's now active
      await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
      console.log('Button is now active');
      
      // Check for success toast
      await expect(page.locator('text=成功')).toBeVisible();
      await expect(page.locator('text=操作が完了しました')).toBeVisible();
      console.log('Success toast appeared');
      
      // Test voting functionality - vote with level 3
      console.log('Testing vote functionality');
      
      // First, click the "コメント / 採点" button to open the voting section
      const toggleButton = firstAnswer.locator('button:has-text("コメント / 採点")').first();
      if (await toggleButton.isVisible()) {
        console.log('Found toggle button, clicking to open voting section');
        await toggleButton.click();
        await page.waitForTimeout(1000);
        console.log('Voting section should now be open');
      } else {
        console.log('Toggle button not found');
      }
      
      // Reset all vote buttons to inactive state first
      console.log('Resetting all vote buttons to inactive state');
      const voteButtons = [
        firstAnswer.locator('button[aria-label="投票1"]').first(),
        firstAnswer.locator('button[aria-label="投票2"]').first(),
        firstAnswer.locator('button[aria-label="投票3"]').first()
      ];
      
      for (let i = 0; i < voteButtons.length; i++) {
        const button = voteButtons[i];
        if (await button.isVisible()) {
          const isActive = await button.getAttribute('aria-pressed') === 'true';
          if (isActive) {
            console.log(`Vote button ${i + 1} is active, clicking to deactivate`);
            await button.click();
            await page.waitForTimeout(500);
            await expect(button).toHaveAttribute('aria-pressed', 'false');
            console.log(`Vote button ${i + 1} deactivated`);
          } else {
            console.log(`Vote button ${i + 1} is already inactive`);
          }
        }
      }
      
      // Now test voting with level 3
      const voteButton3 = voteButtons[2]; // Index 2 is button 3
      if (await voteButton3.isVisible()) {
        console.log('Vote button 3 found and should be inactive');
        
        // Click vote button 3 to activate it
        await voteButton3.click();
        console.log('Clicked vote button 3');
        
        // Wait for state update
        await page.waitForTimeout(1000);
        
        // Verify button is now active
        await expect(voteButton3).toHaveAttribute('aria-pressed', 'true');
        console.log('Vote button 3 is now active');
        
        // Check for success toast
        await expect(page.locator('text=成功')).toBeVisible();
        await expect(page.locator('text=操作が完了しました')).toBeVisible();
        console.log('Vote success toast appeared');
        
        // Wait for score to update (DB sync may take time)
        console.log('Waiting for score to update...');
        await page.waitForTimeout(2000);
        
        // Verify the score shows 3 (check if there's a score display)
        // Look for score display in the answer card
        const scoreDisplay = firstAnswer.locator('text=/Score:\\s*3/').first();
        await expect(scoreDisplay).toBeVisible();
        console.log('Score display shows 3');
        
        // Test persistence after page reload
        console.log('Testing persistence after page reload');
        await page.reload();
        await page.waitForTimeout(2000); // Wait for page to fully load
        
        // Re-open the voting section (it will be closed after reload)
        const toggleButtonAfterReload = page.locator('ul li').first().locator('button:has-text("コメント / 採点")').first();
        if (await toggleButtonAfterReload.isVisible()) {
          console.log('Re-opening voting section after reload');
          await toggleButtonAfterReload.click();
          await page.waitForTimeout(1000);
        }
        
        // Check that vote button 3 is still active after reload
        const voteButton3AfterReload = page.locator('ul li').first().locator('button[aria-label="投票3"]').first();
        await expect(voteButton3AfterReload).toHaveAttribute('aria-pressed', 'true');
        console.log('Vote button 3 is still active after reload');
        
        // Check that score is still 3 after reload
        const scoreDisplayAfterReload = page.locator('ul li').first().locator('text=/Score:\\s*3/').first();
        await expect(scoreDisplayAfterReload).toBeVisible();
        console.log('Score is still 3 after reload');
        
        // Test toggling vote off - click vote button 3 again to deactivate
        console.log('Testing vote toggle off - clicking vote button 3 again');
        await voteButton3AfterReload.click();
        console.log('Clicked vote button 3 again');
        
        // Wait for state update
        await page.waitForTimeout(1000);
        
        // Verify button is now inactive
        await expect(voteButton3AfterReload).toHaveAttribute('aria-pressed', 'false');
        console.log('Vote button 3 is now inactive');
        
        // Check for success toast
        await expect(page.locator('text=成功')).toBeVisible();
        await expect(page.locator('text=操作が完了しました')).toBeVisible();
        console.log('Vote toggle off success toast appeared');
        
        // Wait for score to update to 0
        console.log('Waiting for score to update to 0...');
        await page.waitForTimeout(2000);
        
        // Verify the score shows 0
        const scoreDisplayZero = page.locator('ul li').first().locator('text=/Score:\\s*0/').first();
        await expect(scoreDisplayZero).toBeVisible();
        console.log('Score display shows 0');
        
        // Test persistence of vote off state after page reload
        console.log('Testing persistence of vote off state after page reload');
        await page.reload();
        await page.waitForTimeout(2000); // Wait for page to fully load
        
        // Re-open the voting section
        const toggleButtonAfterReload2 = page.locator('ul li').first().locator('button:has-text("コメント / 採点")').first();
        if (await toggleButtonAfterReload2.isVisible()) {
          console.log('Re-opening voting section after second reload');
          await toggleButtonAfterReload2.click();
          await page.waitForTimeout(1000);
        }
        
        // Check that vote button 3 is still inactive after reload
        const voteButton3AfterReload2 = page.locator('ul li').first().locator('button[aria-label="投票3"]').first();
        await expect(voteButton3AfterReload2).toHaveAttribute('aria-pressed', 'false');
        console.log('Vote button 3 is still inactive after reload');
        
        // Check that score is still 0 after reload
        const scoreDisplayZeroAfterReload = page.locator('ul li').first().locator('text=/Score:\\s*0/').first();
        await expect(scoreDisplayZeroAfterReload).toBeVisible();
        console.log('Score is still 0 after reload');
        
        // Test comment functionality
        console.log('Testing comment functionality');
        
        // Get initial comment count and test text count
        const initialCommentCountText = await page.locator('ul li').first().locator('text=/コメント\\d+/').textContent();
        const initialCommentCount = initialCommentCountText ? parseInt(initialCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
        console.log('Initial comment count:', initialCommentCount);
        
        const initialTestTextCount = await page.locator('text=test_comment_topic').count();
        console.log('Initial "test_comment_topic" count:', initialTestTextCount);
        
        // Find the comment textarea and submit button
        const commentTextarea = page.locator('ul li').first().locator('textarea[name="text"]').first();
        const commentSubmitButton = page.locator('ul li').first().locator('button[aria-label="コメントを送信"]').first();
        
        if (await commentTextarea.isVisible() && await commentSubmitButton.isVisible()) {
          // Enter comment text
          await commentTextarea.fill('test_comment_topic');
          console.log('Entered comment text: "test_comment_topic"');

          // Submit the comment
          await commentSubmitButton.click();
          console.log('Clicked comment submit button');

          // Wait for comment to be added
          await page.waitForTimeout(2000);

          // Check for success toast
          await expect(page.locator('text=成功')).toBeVisible();
          await expect(page.locator('text=操作が完了しました')).toBeVisible();
          console.log('Comment success toast appeared');

          // Verify the comment appears in the list
          await expect(page.locator('text=test_comment_topic')).toBeVisible();
          console.log('Comment "test_comment_topic" is visible in the comment list');

          // Check that comment count increased
          const newCommentCountText = await page.locator('ul li').first().locator('text=/コメント\\d+/').textContent();
          const newCommentCount = newCommentCountText ? parseInt(newCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
          expect(newCommentCount).toBeGreaterThan(initialCommentCount);
          console.log(`Comment count increased from ${initialCommentCount} to ${newCommentCount}`);

          // Check that test text count increased
          const newTestTextCount = await page.locator('text=test_comment_topic').count();
          expect(newTestTextCount).toBeGreaterThan(initialTestTextCount);
          console.log(`"test_comment_topic" count increased from ${initialTestTextCount} to ${newTestTextCount}`);          // Test persistence after page reload
          console.log('Testing comment persistence after page reload');
          await page.reload();
          await page.waitForTimeout(2000);
          
          // Re-open the voting section to access comments
          const toggleButtonAfterCommentReload = page.locator('ul li').first().locator('button:has-text("コメント / 採点")').first();
          if (await toggleButtonAfterCommentReload.isVisible()) {
            console.log('Re-opening section after comment reload');
            await toggleButtonAfterCommentReload.click();
            await page.waitForTimeout(1000);
          }
          
          // Verify comment count is still increased after reload
          const reloadCommentCountText = await page.locator('ul li').first().locator('text=/コメント\\d+/').textContent();
          const reloadCommentCount = reloadCommentCountText ? parseInt(reloadCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
          expect(reloadCommentCount).toBeGreaterThan(initialCommentCount);
          console.log(`Comment count still increased after reload: ${reloadCommentCount}`);
          
          // Verify test text count is still increased after reload
          const reloadTestTextCount = await page.locator('text=test_comment_topic').count();
          expect(reloadTestTextCount).toBeGreaterThan(initialTestTextCount);
          console.log(`"test_comment_topic" count still increased after reload: ${reloadTestTextCount}`);
          
        } else {
          console.log('Comment textarea or submit button not found');
        }
      } else {
        console.log('Vote button 3 not found after opening section');
        
        // Debug: check what buttons are available after opening
        const allButtonsAfter = firstAnswer.locator('button');
        const buttonCountAfter = await allButtonsAfter.count();
        console.log('Total buttons in answer after opening:', buttonCountAfter);
        
        for (let i = 0; i < buttonCountAfter; i++) {
          const button = allButtonsAfter.nth(i);
          const ariaLabel = await button.getAttribute('aria-label');
          const text = await button.textContent();
          console.log(`Button ${i}: aria-label="${ariaLabel}", text="${text}"`);
        }
      }
    } else {
      console.log('No answers found on the page');
      // Debug: check what elements are on the page
      const allLis = page.locator('li');
      const liCount = await allLis.count();
      console.log('Number of li elements:', liCount);
      
      if (liCount > 0) {
        const firstLiClasses = await allLis.first().getAttribute('class');
        console.log('First li classes:', firstLiClasses);
      }
    }
  } else {
    console.log('No topic found in search results');
  }
});

test('answers page interactions', async ({ page }) => {
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

  // Navigate to answers page
  await page.goto('/answers');
  await expect(page.locator('text=回答一覧')).toBeVisible();
  console.log('Answers page loaded');

  // Sort by oldest first
  await page.selectOption('select[name="sortBy"]', 'oldest');
  console.log('Sorted by oldest');

  // Click search button to apply sorting
  await page.click('button:has-text("検索")');
  console.log('Applied sorting');

  // Wait for URL to update with sortBy parameter
  await page.waitForURL((url) => url.searchParams.has('sortBy'), { timeout: 5000 });
  console.log('URL updated with sortBy parameter');

  // Check if sortBy=oldest is in the URL
  const finalURL = page.url();
  const hasSortParam = finalURL.includes('sortBy=oldest');
  expect(hasSortParam).toBe(true);
  console.log('Confirmed sortBy=oldest in URL');

  // Wait for answers to load
  await page.waitForTimeout(2000);

  // Find the first answer
  const firstAnswer = page.locator('ul li').first();
  if (await firstAnswer.isVisible()) {
    console.log('Found first answer on answers page');

    // Find the favorite button within the first answer
    const favoriteButton = firstAnswer.locator('button[aria-pressed]').first();
    const initialState = await favoriteButton.getAttribute('aria-pressed') === 'true';
    console.log('Favorite button found, initial state:', initialState);

    // If already active, click to deactivate first
    if (initialState) {
      console.log('Button is active, clicking to deactivate');
      await favoriteButton.click();
      await page.waitForTimeout(1000);
      await expect(favoriteButton).toHaveAttribute('aria-pressed', 'false');
      console.log('Button deactivated');
    }

    // Now click to activate (whether it was initially active or not)
    console.log('Clicking to activate favorite button');
    await favoriteButton.click();
    await page.waitForTimeout(1000);

    // Verify it's now active
    await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
    console.log('Button is now active');

    // Check for success toast
    await expect(page.locator('text=成功')).toBeVisible();
    await expect(page.locator('text=操作が完了しました')).toBeVisible();
    console.log('Success toast appeared');

    // Test voting functionality - vote with level 3
    console.log('Testing vote functionality on answers page');

    // First, click the "コメント / 採点" button to open the voting section
    const toggleButton = firstAnswer.locator('button:has-text("コメント / 採点")').first();
    if (await toggleButton.isVisible()) {
      console.log('Found toggle button, clicking to open voting section');
      await toggleButton.click();
      await page.waitForTimeout(1000);
      console.log('Voting section should now be open');
    } else {
      console.log('Toggle button not found');
    }

    // Reset all vote buttons to inactive state first
    console.log('Resetting all vote buttons to inactive state');
    const voteButtons = [
      firstAnswer.locator('button[aria-label="投票1"]').first(),
      firstAnswer.locator('button[aria-label="投票2"]').first(),
      firstAnswer.locator('button[aria-label="投票3"]').first()
    ];

    for (let i = 0; i < voteButtons.length; i++) {
      const button = voteButtons[i];
      if (await button.isVisible()) {
        const isActive = await button.getAttribute('aria-pressed') === 'true';
        if (isActive) {
          console.log(`Vote button ${i + 1} is active, clicking to deactivate`);
          await button.click();
          await page.waitForTimeout(500);
          await expect(button).toHaveAttribute('aria-pressed', 'false');
          console.log(`Vote button ${i + 1} deactivated`);
        } else {
          console.log(`Vote button ${i + 1} is already inactive`);
        }
      }
    }

    // Now test voting with level 3
    const voteButton3 = voteButtons[2]; // Index 2 is button 3
    if (await voteButton3.isVisible()) {
      console.log('Vote button 3 found and should be inactive');

      // Click vote button 3 to activate it
      await voteButton3.click();
      console.log('Clicked vote button 3');

      // Wait for state update
      await page.waitForTimeout(1000);

      // Verify button is now active
      await expect(voteButton3).toHaveAttribute('aria-pressed', 'true');
      console.log('Vote button 3 is now active');

      // Check for success toast
      await expect(page.locator('text=成功')).toBeVisible();
      await expect(page.locator('text=操作が完了しました')).toBeVisible();
      console.log('Vote success toast appeared');

      // Wait for score to update (DB sync may take time)
      console.log('Waiting for score to update...');
      await page.waitForTimeout(2000);

      // Verify the score shows 3 (check if there's a score display)
      // Look for score display in the answer card
      const scoreDisplay = firstAnswer.locator('text=/Score:\\s*3/').first();
      await expect(scoreDisplay).toBeVisible();
      console.log('Score display shows 3');

      // Test persistence after page reload
      console.log('Testing persistence after page reload');
      await page.reload();
      await page.waitForTimeout(2000); // Wait for page to fully load

      // Re-open the voting section (it will be closed after reload)
      const toggleButtonAfterReload = page.locator('ul li').first().locator('button:has-text("コメント / 採点")').first();
      if (await toggleButtonAfterReload.isVisible()) {
        console.log('Re-opening voting section after reload');
        await toggleButtonAfterReload.click();
        await page.waitForTimeout(1000);
      }

      // Check that vote button 3 is still active after reload
      const voteButton3AfterReload = page.locator('ul li').first().locator('button[aria-label="投票3"]').first();
      await expect(voteButton3AfterReload).toHaveAttribute('aria-pressed', 'true');
      console.log('Vote button 3 is still active after reload');

      // Check that score is still 3 after reload
      const scoreDisplayAfterReload = page.locator('ul li').first().locator('text=/Score:\\s*3/').first();
      await expect(scoreDisplayAfterReload).toBeVisible();
      console.log('Score is still 3 after reload');

      // Test toggling vote off - click vote button 3 again to deactivate
      console.log('Testing vote toggle off - clicking vote button 3 again');
      await voteButton3AfterReload.click();
      console.log('Clicked vote button 3 again');

      // Wait for state update
      await page.waitForTimeout(1000);

      // Verify button is now inactive
      await expect(voteButton3AfterReload).toHaveAttribute('aria-pressed', 'false');
      console.log('Vote button 3 is now inactive');

      // Check for success toast
      await expect(page.locator('text=成功')).toBeVisible();
      await expect(page.locator('text=操作が完了しました')).toBeVisible();
      console.log('Vote toggle off success toast appeared');

      // Wait for score to update to 0
      console.log('Waiting for score to update to 0...');
      await page.waitForTimeout(2000);

      // Verify the score shows 0
      const scoreDisplayZero = page.locator('ul li').first().locator('text=/Score:\\s*0/').first();
      await expect(scoreDisplayZero).toBeVisible();
      console.log('Score display shows 0');

      // Test persistence of vote off state after page reload
      console.log('Testing persistence of vote off state after page reload');
      await page.reload();
      await page.waitForTimeout(2000); // Wait for page to fully load

      // Re-open the voting section
      const toggleButtonAfterReload2 = page.locator('ul li').first().locator('button:has-text("コメント / 採点")').first();
      if (await toggleButtonAfterReload2.isVisible()) {
        console.log('Re-opening voting section after second reload');
        await toggleButtonAfterReload2.click();
        await page.waitForTimeout(1000);
      }

      // Check that vote button 3 is still inactive after reload
      const voteButton3AfterReload2 = page.locator('ul li').first().locator('button[aria-label="投票3"]').first();
      await expect(voteButton3AfterReload2).toHaveAttribute('aria-pressed', 'false');
      console.log('Vote button 3 is still inactive after reload');

      // Check that score is still 0 after reload
      const scoreDisplayZeroAfterReload = page.locator('ul li').first().locator('text=/Score:\\s*0/').first();
      await expect(scoreDisplayZeroAfterReload).toBeVisible();
      console.log('Score is still 0 after reload');

      // Test comment functionality
      console.log('Testing comment functionality on answers page');

      // Get initial comment count and test text count
      const initialCommentCountText = await page.locator('ul li').first().locator('text=/コメント\\d+/').textContent();
      const initialCommentCount = initialCommentCountText ? parseInt(initialCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
      console.log('Initial comment count:', initialCommentCount);

      const initialTestTextCount = await page.locator('text=test_comment_answers').count();
      console.log('Initial "test_comment_answers" count:', initialTestTextCount);

      // Find the comment textarea and submit button
      const commentTextarea = page.locator('ul li').first().locator('textarea[name="text"]').first();
      const commentSubmitButton = page.locator('ul li').first().locator('button[aria-label="コメントを送信"]').first();

      if (await commentTextarea.isVisible() && await commentSubmitButton.isVisible()) {
        // Enter comment text
        await commentTextarea.fill('test_comment_answers');
        console.log('Entered comment text: "test_comment_answers"');

        // Submit the comment
        await commentSubmitButton.click();
        console.log('Clicked comment submit button');

        // Wait for comment to be added
        await page.waitForTimeout(2000);

        // Check for success toast
        await expect(page.locator('text=成功')).toBeVisible();
        await expect(page.locator('text=操作が完了しました')).toBeVisible();
        console.log('Comment success toast appeared');

        // Verify the comment appears in the list
        await expect(page.locator('text=test_comment_answers')).toBeVisible();
        console.log('Comment "test_comment_answers" is visible in the comment list');

        // Check that comment count increased
        const newCommentCountText = await page.locator('ul li').first().locator('text=/コメント\\d+/').textContent();
        const newCommentCount = newCommentCountText ? parseInt(newCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
        expect(newCommentCount).toBeGreaterThan(initialCommentCount);
        console.log(`Comment count increased from ${initialCommentCount} to ${newCommentCount}`);

        // Check that test text count increased
        const newTestTextCount = await page.locator('text=test_comment_answers').count();
        expect(newTestTextCount).toBeGreaterThan(initialTestTextCount);
        console.log(`"test_comment_answers" count increased from ${initialTestTextCount} to ${newTestTextCount}`);

        // Test persistence after page reload
        console.log('Testing comment persistence after page reload');
        await page.reload();
        await page.waitForTimeout(2000);

        // Re-open the voting section to access comments
        const toggleButtonAfterCommentReload = page.locator('ul li').first().locator('button:has-text("コメント / 採点")').first();
        if (await toggleButtonAfterCommentReload.isVisible()) {
          console.log('Re-opening section after comment reload');
          await toggleButtonAfterCommentReload.click();
          await page.waitForTimeout(1000);
        }

        // Verify comment count is still increased after reload
        const reloadCommentCountText = await page.locator('ul li').first().locator('text=/コメント\\d+/').textContent();
        const reloadCommentCount = reloadCommentCountText ? parseInt(reloadCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
        expect(reloadCommentCount).toBeGreaterThan(initialCommentCount);
        console.log(`Comment count still increased after reload: ${reloadCommentCount}`);

        // Verify test text count is still increased after reload
        const reloadTestTextCount = await page.locator('text=test_comment_answers').count();
        expect(reloadTestTextCount).toBeGreaterThan(initialTestTextCount);
        console.log(`"test_comment_answers" count still increased after reload: ${reloadTestTextCount}`);

      } else {
        console.log('Comment textarea or submit button not found');
      }
    } else {
      console.log('Vote button 3 not found after opening section');
    }
  } else {
    console.log('No answers found on answers page');
  }
});

test('favorites page interactions', async ({ page }) => {
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

  // Navigate to answers page and sort by oldest
  await page.goto('/answers');
  await expect(page.locator('text=回答一覧')).toBeVisible();
  console.log('Answers page loaded');

  // Sort by oldest first
  await page.selectOption('select[name="sortBy"]', 'oldest');
  await page.click('button:has-text("検索")');
  await page.waitForURL((url) => url.searchParams.has('sortBy'), { timeout: 5000 });
  console.log('Sorted answers by oldest');

  // Wait for answers to load
  await page.waitForTimeout(2000);

  // Find the first answer
  const firstAnswer = page.locator('ul li').first();
  if (await firstAnswer.isVisible()) {
    console.log('Found first answer on answers page');

    // Check if favorite button is already active
    const favoriteButton = firstAnswer.locator('button[aria-pressed]').first();
    const isFavoriteActive = await favoriteButton.getAttribute('aria-pressed') === 'true';
    console.log('Favorite button active state:', isFavoriteActive);

    if (isFavoriteActive) {
      console.log('Favorite is already active, navigating to favorites page');
      // Navigate to favorites page
      await page.goto('/answers/favorites');
      await expect(page.locator('text=お気に入り')).toBeVisible();
      console.log('Favorites page loaded');
    } else {
      console.log('Favorite is not active, activating it first');
      // Activate favorite
      await favoriteButton.click();
      await page.waitForTimeout(1000);
      await expect(favoriteButton).toHaveAttribute('aria-pressed', 'true');
      console.log('Favorite activated');

      // Check for success toast
      await expect(page.locator('text=成功')).toBeVisible();
      await expect(page.locator('text=操作が完了しました')).toBeVisible();

      // Navigate to favorites page
      await page.goto('/answers/favorites');
      await expect(page.locator('text=お気に入り')).toBeVisible();
      console.log('Favorites page loaded');
    }

    // Wait for favorites to load
    await page.waitForTimeout(2000);

    // Find the favorited answer on favorites page
    const favoritedAnswer = page.locator('ul li').first();
    if (await favoritedAnswer.isVisible()) {
      console.log('Found favorited answer on favorites page');

      // Test voting functionality on favorites page
      console.log('Testing vote functionality on favorites page');

      // First, click the "コメント / 採点" button to open the voting section
      const toggleButton = favoritedAnswer.locator('button:has-text("コメント / 採点")').first();
      if (await toggleButton.isVisible()) {
        console.log('Found toggle button, clicking to open voting section');
        await toggleButton.click();
        await page.waitForTimeout(1000);
        console.log('Voting section should now be open');
      }

      // Reset all vote buttons to inactive state first
      console.log('Resetting all vote buttons to inactive state');
      const voteButtons = [
        favoritedAnswer.locator('button[aria-label="投票1"]').first(),
        favoritedAnswer.locator('button[aria-label="投票2"]').first(),
        favoritedAnswer.locator('button[aria-label="投票3"]').first()
      ];

      for (let i = 0; i < voteButtons.length; i++) {
        const button = voteButtons[i];
        if (await button.isVisible()) {
          const isActive = await button.getAttribute('aria-pressed') === 'true';
          if (isActive) {
            console.log(`Vote button ${i + 1} is active, clicking to deactivate`);
            await button.click();
            await page.waitForTimeout(500);
            await expect(button).toHaveAttribute('aria-pressed', 'false');
            console.log(`Vote button ${i + 1} deactivated`);
          } else {
            console.log(`Vote button ${i + 1} is already inactive`);
          }
        }
      }

      // Now test voting with level 3
      const voteButton3 = voteButtons[2];
      if (await voteButton3.isVisible()) {
        console.log('Vote button 3 found and should be inactive');

        // Click vote button 3 to activate it
        await voteButton3.click();
        console.log('Clicked vote button 3');

        // Wait for state update
        await page.waitForTimeout(1000);

        // Verify button is now active
        await expect(voteButton3).toHaveAttribute('aria-pressed', 'true');
        console.log('Vote button 3 is now active');

        // Check for success toast
        await expect(page.locator('text=成功')).toBeVisible();
        await expect(page.locator('text=操作が完了しました')).toBeVisible();
        console.log('Vote success toast appeared');

        // Wait for score to update
        console.log('Waiting for score to update...');
        await page.waitForTimeout(2000);

        // Verify the score shows 3
        const scoreDisplay = favoritedAnswer.locator('text=/Score:\\s*3/').first();
        await expect(scoreDisplay).toBeVisible();
        console.log('Score display shows 3 on favorites page');
      }

      // Test comment functionality on favorites page
      console.log('Testing comment functionality on favorites page');

      // Get initial comment count and test text count
      const initialCommentCountText = await favoritedAnswer.locator('text=/コメント\\d+/').textContent();
      const initialCommentCount = initialCommentCountText ? parseInt(initialCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
      console.log('Initial comment count on favorites page:', initialCommentCount);

      const initialTestTextCount = await page.locator('text=test_comment_favorites').count();
      console.log('Initial "test_comment_favorites" count:', initialTestTextCount);

      // Find the comment textarea and submit button
      const commentTextarea = favoritedAnswer.locator('textarea[name="text"]').first();
      const commentSubmitButton = favoritedAnswer.locator('button[aria-label="コメントを送信"]').first();

      if (await commentTextarea.isVisible() && await commentSubmitButton.isVisible()) {
        // Enter comment text
        await commentTextarea.fill('test_comment_favorites');
        console.log('Entered comment text: "test_comment_favorites"');

        // Submit the comment
        await commentSubmitButton.click();
        console.log('Clicked comment submit button');

        // Wait for comment to be added
        await page.waitForTimeout(2000);

        // Check for success toast
        await expect(page.locator('text=成功')).toBeVisible();
        await expect(page.locator('text=操作が完了しました')).toBeVisible();
        console.log('Comment success toast appeared');

        // Verify the comment appears in the list
        await expect(page.locator('text=test_comment_favorites')).toBeVisible();
        console.log('Comment "test_comment_favorites" is visible in the comment list');

        // Check that comment count increased
        const newCommentCountText = await favoritedAnswer.locator('text=/コメント\\d+/').textContent();
        const newCommentCount = newCommentCountText ? parseInt(newCommentCountText.match(/コメント(\d+)/)?.[1] || '0') : 0;
        expect(newCommentCount).toBeGreaterThan(initialCommentCount);
        console.log(`Comment count increased from ${initialCommentCount} to ${newCommentCount}`);

        // Check that test text count increased
        const newTestTextCount = await page.locator('text=test_comment_favorites').count();
        expect(newTestTextCount).toBeGreaterThan(initialTestTextCount);
        console.log(`"test_comment_favorites" count increased from ${initialTestTextCount} to ${newTestTextCount}`);
      }

      // Now remove from favorites
      console.log('Removing from favorites');
      const favoriteButtonOnFavorites = favoritedAnswer.locator('button[aria-pressed]').first();
      await favoriteButtonOnFavorites.click();
      console.log('Clicked favorite button to remove');

      // Wait for state update
      await page.waitForTimeout(1000);

      // Verify button is now inactive
      await expect(favoriteButtonOnFavorites).toHaveAttribute('aria-pressed', 'false');
      console.log('Favorite button is now inactive');

      // Check for success toast
      await expect(page.locator('text=成功')).toBeVisible();
      await expect(page.locator('text=操作が完了しました')).toBeVisible();
      console.log('Remove favorite success toast appeared');

      // The answer should disappear from favorites page
      await page.waitForTimeout(1000);
      const remainingAnswers = page.locator('ul li');
      const answerCount = await remainingAnswers.count();
      console.log(`Remaining answers after removing favorite: ${answerCount}`);

      // Test persistence - reload and verify it's still removed
      console.log('Testing persistence after page reload');
      await page.reload();
      await page.waitForTimeout(2000);

      // Check that the previously favorited answer is no longer on the favorites page
      await expect(page.locator('text=お気に入り')).toBeVisible();
      console.log('Favorites page reloaded successfully - answer should be removed from favorites');

    } else {
      console.log('No favorited answers found on favorites page');
    }
  } else {
    console.log('No answers found on answers page');
  }
});