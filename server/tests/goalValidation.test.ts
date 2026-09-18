import { goalValidator } from '../agent/goalValidator.ts';
import type { PageObservation } from '../observation/observationTypes.ts';
import type { ExtractedResultItem, AgentHistoryItem } from '../agent/agentTypes.ts';

function createMockObservation(overrides: Partial<PageObservation> = {}): PageObservation {
  return {
    url: 'https://example.com',
    title: 'Example Page',
    headings: ['Welcome'],
    visibleText: ['Some content here'],
    contentItems: [],
    interactiveElements: [],
    timestamp: '12:00:00 PM',
    stats: {
      totalInteractiveCount: 0,
      buttonCount: 0,
      linkCount: 0,
      inputCount: 0,
      otherCount: 0,
    },
    ...overrides,
  };
}

function runTests() {
  console.log('=== RUNNING GOAL VALIDATION TEST SUITE ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    total++;
    if (condition) {
      console.log(`PASS: ${testName}`);
      passed++;
    } else {
      console.error(`FAIL: ${testName} - ${detail || 'Condition false'}`);
    }
  }

  // ----------------------------------------------------
  // SCENARIO 4: Navigation to example.com
  // ----------------------------------------------------
  {
    console.log('--- TEST 4: Navigation Goal Verification (example.com) ---');
    const goal = 'Open the example website.';
    const obs = createMockObservation({
      url: 'https://example.com/',
      title: 'Example Domain',
      visibleText: ['This domain is for use in illustrative examples in documents.'],
      headings: ['Example Domain'],
    });

    const res = goalValidator.validateGoal(goal, 'NAVIGATION', [], obs, []);
    assert(res.isSatisfied === true, 'Test 4: Navigation goal satisfied when page loaded');
    assert(res.status === 'COMPLETED', 'Test 4: Status is COMPLETED');
  }

  // ----------------------------------------------------
  // SCENARIO 2: Wikipedia Search Results Page (hyd food)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 2: Intermediate Search Results Validation (Wikipedia - hyd food) ---');
    const goal = 'hyd food';
    const searchObs = createMockObservation({
      url: 'https://en.wikipedia.org/w/index.php?search=hyd+food&title=Special:Search&profile=advanced&fulltext=1&ns0=1',
      title: 'hyd food - Search results - Wikipedia',
      headings: ['Search results'],
      visibleText: ['Results 1–20 of 78', 'For search options, see Help:Searching.', 'Hyderabadi cuisine', 'Street food in Hyderabad'],
      contentItems: ['Hyderabadi cuisine - Search result snippet', 'Street food in Hyderabad - Search result snippet'],
    });

    // Case A: Gemini attempts to finish merely because search returned "Results 1–20"
    const prematureFinishRes = goalValidator.validateGoal(
      goal,
      'INFORMATION_RETRIEVAL',
      [],
      searchObs,
      [],
      'Search returned 20 results for hyd food.'
    );
    assert(prematureFinishRes.isSatisfied === false, 'Test 2A: Search results page rejects premature FINISH');
    assert(prematureFinishRes.status === 'CONTINUE', 'Test 2A: Agent instructed to CONTINUE navigating');

    // Case B: Agent clicked into "Hyderabadi cuisine" article and gathered actual cuisine content
    const articleObs = createMockObservation({
      url: 'https://en.wikipedia.org/wiki/Hyderabadi_cuisine',
      title: 'Hyderabadi cuisine - Wikipedia',
      headings: ['Hyderabadi cuisine', 'Specialties', 'Desserts'],
      visibleText: ['Hyderabadi Biryani is a rice-based dish made with spices and meat.', 'Hyderabadi Haleem is a stew composed of meat, lentils and pounded wheat.'],
    });
    const retrievedItems: ExtractedResultItem[] = [
      { name: 'Hyderabadi Biryani', details: 'Traditional slow-cooked spiced basmati rice with marinated meat' },
      { name: 'Hyderabadi Haleem', details: 'Savory stew made of pounded wheat, lentils, and meat cooked with ghee' },
      { name: 'Mirchi ka Salan', details: 'Popular chili and peanut curry accompaniment' },
    ];
    const articleRes = goalValidator.validateGoal(
      goal,
      'INFORMATION_RETRIEVAL',
      retrievedItems,
      articleObs,
      [{ stepNumber: 1, action: { action: 'click' }, result: 'success', message: 'Navigated to article' }]
    );
    assert(articleRes.isSatisfied === true, 'Test 2B: Substantive content on article page COMPLETED');
  }

  // ----------------------------------------------------
  // SCENARIO 3: Product Search Constraints (Flipkart Lenovo Laptop)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 3: Strict Constraint Validation (Flipkart - Lenovo Laptop) ---');
    const goal = 'Lenovo laptop under 80,000 16GB ram and intel core 7';
    const reqs = goalValidator.extractRequirements(goal);

    assert(reqs.brand === 'Lenovo', 'Test 3: Extracted brand Lenovo');
    assert(reqs.maxPrice === 80000, 'Test 3: Extracted maxPrice 80000');
    assert(reqs.minRamGb === 16, 'Test 3: Extracted 16GB RAM');
    assert(reqs.processor?.family === 'Core 7', 'Test 3: Extracted processor family Core 7');
    assert(reqs.processor?.requiredBrand === 'Intel', 'Test 3: Extracted processor brand Intel');

    const productObs = createMockObservation({
      url: 'https://www.flipkart.com/search?q=Lenovo+laptop',
      title: 'Lenovo Laptops - Flipkart',
      visibleText: [
        'Lenovo IdeaPad Slim 5 Intel Core Ultra 5 225U - ₹69,990',
        'Lenovo IdeaPad 3 AMD Ryzen 7 5825U - ₹59,990',
        'Lenovo Yoga Slim 7 Intel Core 7 150U - ₹86,990',
        'Lenovo IdeaPad Slim 5 Intel Core 7 150U (16GB RAM / 512GB SSD) - ₹74,990',
      ],
    });

    // Test Candidate 1: Lenovo Ultra 5 225U (Ultra 5 is NOT Intel Core 7)
    const candUltra5: ExtractedResultItem = {
      name: 'Lenovo IdeaPad Slim 5 Intel Core Ultra 5 225U (16GB RAM)',
      details: '16GB RAM, Price: ₹69,990, Intel Core Ultra 5',
    };
    const checkUltra5 = goalValidator.validateCandidate(candUltra5, reqs, productObs);
    assert(checkUltra5.isValid === false, 'Test 3: Rejected Ultra 5 225U (not Core 7)');

    // Test Candidate 2: Lenovo Ryzen 7 (AMD is NOT Intel)
    const candRyzen: ExtractedResultItem = {
      name: 'Lenovo IdeaPad 3 AMD Ryzen 7 5825U',
      details: '16GB RAM, Price: ₹59,990, AMD Ryzen 7',
    };
    const checkRyzen = goalValidator.validateCandidate(candRyzen, reqs, productObs);
    assert(checkRyzen.isValid === false, 'Test 3: Rejected Ryzen 7 (AMD forbidden for Intel)');

    // Test Candidate 3: Overpriced Core 7 (₹86,990 > ₹80,000)
    const candOverprice: ExtractedResultItem = {
      name: 'Lenovo Yoga Slim 7 Intel Core 7 150U',
      details: '16GB RAM, Price: ₹86,990, Intel Core 7',
    };
    const checkOverprice = goalValidator.validateCandidate(candOverprice, reqs, productObs);
    assert(checkOverprice.isValid === false, 'Test 3: Rejected Price > 80,000');

    // Test Candidate 4: Insufficient RAM (8GB < 16GB)
    const candLowRam: ExtractedResultItem = {
      name: 'Lenovo IdeaPad Intel Core 7',
      details: '8GB RAM, Price: ₹71,990, Intel Core 7',
    };
    const checkLowRam = goalValidator.validateCandidate(candLowRam, reqs, productObs);
    assert(checkLowRam.isValid === false, 'Test 3: Rejected 8GB RAM (less than 16GB)');

    // Test Candidate 5: Perfect match (Lenovo, Intel Core 7, 16GB RAM, ₹74,990 <= 80,000)
    const candValid: ExtractedResultItem = {
      name: 'Lenovo IdeaPad Slim 5 Intel Core 7 150U (16GB RAM / 512GB SSD) - ₹74,990',
      details: '16GB RAM, 512GB SSD, Intel Core 7 150U, Price: ₹74,990',
    };
    const checkValid = goalValidator.validateCandidate(candValid, reqs, productObs);
    assert(checkValid.isValid === true, 'Test 3: Accepted valid candidate satisfying ALL constraints');

    // Full goal validation with invalid candidates only -> MUST REJECT
    const failRes = goalValidator.validateGoal(goal, 'INFORMATION_RETRIEVAL', [candUltra5, candRyzen], productObs, []);
    assert(failRes.isSatisfied === false, 'Test 3: Full goal validation fails when candidates violate constraints');
    assert(failRes.rejectedResults.length === 2, 'Test 3: Exactly 2 candidates recorded in rejectedResults');

    // Full goal validation with valid candidate -> SATISFIED
    const passRes = goalValidator.validateGoal(goal, 'INFORMATION_RETRIEVAL', [candValid], productObs, []);
    assert(passRes.isSatisfied === true, 'Test 3: Full goal validation succeeds with valid candidate');
    assert(passRes.validatedResults.length === 1, 'Test 3: Validated candidate in validatedResults');
  }

  // ----------------------------------------------------
  // SCENARIO 1: IMDb Recent Telugu Movies (TEST 1)
  // ----------------------------------------------------
  {
    console.log('\n--- TEST 1: IMDb Recent Telugu Movies Validation ---');
    const goal = 'recent Telugu movies';
    const imdbSearchObs = createMockObservation({
      url: 'https://www.imdb.com/find/?q=telugu',
      title: 'Find - IMDb',
      visibleText: ['Search IMDb', 'Titles', 'Search results for "telugu"'],
    });

    // Action/search succeeded, but no movie items retrieved yet
    const imdbPremature = goalValidator.validateGoal(goal, 'INFORMATION_RETRIEVAL', [], imdbSearchObs, []);
    assert(imdbPremature.isSatisfied === false, 'Test 1: Search success alone does not satisfy goal');

    // Telugu movies actually collected and grounded on page
    const imdbResultsObs = createMockObservation({
      url: 'https://www.imdb.com/feature/telugu-movies',
      title: 'Telugu Movies - IMDb',
      visibleText: ['Kalki 2898 AD', 'Guntur Kaaram', 'Hanu-Man', 'Salaar: Part 1 – Ceasefire'],
    });
    const teluguMovies: ExtractedResultItem[] = [
      { name: 'Kalki 2898 AD', rating: '7.6', details: '2024, Sci-Fi/Action Telugu film' },
      { name: 'Guntur Kaaram', rating: '6.4', details: '2024, Action/Drama Telugu film' },
      { name: 'Hanu-Man', rating: '7.8', details: '2024, Superhero/Fantasy Telugu film' },
    ];
    const imdbSuccess = goalValidator.validateGoal(goal, 'INFORMATION_RETRIEVAL', teluguMovies, imdbResultsObs, []);
    assert(imdbSuccess.isSatisfied === true, 'Test 1: Satisfied when validated movie items retrieved');
    assert(imdbSuccess.validatedResults.length === 3, 'Test 1: 3 Telugu movies validated');
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed}/${total} assertions passed`);
  console.log(`========================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
