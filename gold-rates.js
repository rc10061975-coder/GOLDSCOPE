const fetch = require("node-fetch");
const cheerio = require("cheerio");

// Cache to avoid hitting source sites too frequently
let cache = {
  data: null,
  timestamp: 0,
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ─── Scraper: KeralaGold.com ───
async function scrapeKeralaGold() {
  try {
    const res = await fetch("https://www.keralagold.com/kerala-gold-rate-per-gram.htm", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 8000,
    });

    if (!res.ok) throw new Error(`KeralaGold HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    // Find the last row in the price table — it's today's rate
    let todayPrice22k = null;
    let yesterdayPrice22k = null;
    const rows = [];

    $("table")
      .find("tr")
      .each((i, row) => {
        const cells = $(row).find("td");
        if (cells.length === 2) {
          const dateText = $(cells[0]).text().trim();
          const priceText = $(cells[1]).text().trim();
          // Extract numeric price
          const priceMatch = priceText.replace(/[^\d]/g, "");
          if (priceMatch && dateText.match(/\d+-\w+-\d+/)) {
            rows.push({
              date: dateText,
              price: parseInt(priceMatch, 10),
            });
          }
        }
      });

    if (rows.length >= 2) {
      todayPrice22k = rows[rows.length - 1].price;
      yesterdayPrice22k = rows[rows.length - 2].price;
    } else if (rows.length === 1) {
      todayPrice22k = rows[0].price;
    }

    // Calculate 24K and 18K from 22K
    // 22K = 91.6% purity, 24K = 99.9%, 18K = 75%
    const todayPrice24k = todayPrice22k
      ? Math.round((todayPrice22k / 0.916) * 0.999)
      : null;
    const todayPrice18k = todayPrice22k
      ? Math.round((todayPrice22k / 0.916) * 0.75)
      : null;

    const change22k =
      todayPrice22k && yesterdayPrice22k
        ? todayPrice22k - yesterdayPrice22k
        : 0;
    const changePct =
      yesterdayPrice22k ? ((change22k / yesterdayPrice22k) * 100).toFixed(2) : 0;

    return {
      source: "KeralaGold.com",
      scraped_at: new Date().toISOString(),
      region: "Kerala",
      rates: {
        "24k": {
          per_gram: todayPrice24k,
          change: Math.round((change22k / 0.916) * 0.999),
          change_pct: parseFloat(changePct),
        },
        "22k": {
          per_gram: todayPrice22k,
          change: change22k,
          change_pct: parseFloat(changePct),
        },
        "18k": {
          per_gram: todayPrice18k,
          change: Math.round((change22k / 0.916) * 0.75),
          change_pct: parseFloat(changePct),
        },
      },
      history: rows.slice(-10), // last 10 data points
    };
  } catch (err) {
    console.error("KeralaGold scrape failed:", err.message);
    return null;
  }
}

// ─── Scraper: BankBazaar fallback ───
async function scrapeBankBazaar() {
  try {
    const res = await fetch("https://www.bankbazaar.com/gold-rate-kerala.html", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 8000,
    });

    if (!res.ok) throw new Error(`BankBazaar HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);

    let price22k = null;
    let price24k = null;

    // BankBazaar typically has prices in specific elements
    $("td, span, div").each((i, el) => {
      const text = $(el).text().trim();
      if (text.match(/₹[\d,]+/) && !price22k) {
        const match = text.replace(/[^\d]/g, "");
        const val = parseInt(match, 10);
        if (val > 5000 && val < 25000) {
          if (!price22k) price22k = val;
          else if (!price24k) price24k = val;
        }
      }
    });

    if (price22k) {
      const todayPrice24k = price24k || Math.round((price22k / 0.916) * 0.999);
      const todayPrice18k = Math.round((price22k / 0.916) * 0.75);

      return {
        source: "BankBazaar.com",
        scraped_at: new Date().toISOString(),
        region: "Kerala",
        rates: {
          "24k": { per_gram: todayPrice24k, change: 0, change_pct: 0 },
          "22k": { per_gram: price22k, change: 0, change_pct: 0 },
          "18k": { per_gram: todayPrice18k, change: 0, change_pct: 0 },
        },
        history: [],
      };
    }
    return null;
  } catch (err) {
    console.error("BankBazaar scrape failed:", err.message);
    return null;
  }
}

// ─── Generate jeweller-specific pricing ───
// In production, these margins would be scraped or provided by jewellers
// For now, we use realistic margin offsets from the base rate
function generateJewellerPrices(baseRates) {
  const jewellers = [
    {
      name: "Malabar Gold & Diamonds",
      location: "SM Street, Kozhikode",
      making: "10%",
      purity_24k: "999.0",
      purity_22k: "916.0",
      rating: 4.7,
      color: "#a78bfa",
      margin: 0, // reference price
    },
    {
      name: "Tanishq",
      location: "MG Road, Kozhikode",
      making: "8%",
      purity_24k: "999.0",
      purity_22k: "916.0",
      rating: 4.8,
      color: "#e8c84a",
      margin: -15,
    },
    {
      name: "Joyalukkas",
      location: "Mavoor Road, Kozhikode",
      making: "9%",
      purity_24k: "999.0",
      purity_22k: "916.0",
      rating: 4.6,
      color: "#fb923c",
      margin: 20,
    },
    {
      name: "Kalyan Jewellers",
      location: "Palayam, Kozhikode",
      making: "11%",
      purity_24k: "999.0",
      purity_22k: "916.0",
      rating: 4.5,
      color: "#f472b6",
      margin: 35,
    },
    {
      name: "Bhima Jewellers",
      location: "Beach Road, Kozhikode",
      making: "8.5%",
      purity_24k: "999.0",
      purity_22k: "916.0",
      rating: 4.6,
      color: "#34d399",
      margin: 10,
    },
    {
      name: "Chemmanur Jewellers",
      location: "Nadakkavu, Kozhikode",
      making: "12%",
      purity_24k: "998.5",
      purity_22k: "915.5",
      rating: 4.3,
      color: "#60a5fa",
      margin: 55,
    },
    {
      name: "Jos Alukkas",
      location: "Town Hall, Kozhikode",
      making: "9.5%",
      purity_24k: "999.0",
      purity_22k: "916.0",
      rating: 4.5,
      color: "#c084fc",
      margin: 25,
    },
    {
      name: "AVR Swarna Mahal",
      location: "Link Road, Kozhikode",
      making: "13%",
      purity_24k: "998.0",
      purity_22k: "915.0",
      rating: 4.2,
      color: "#fbbf24",
      margin: 70,
    },
  ];

  return jewellers.map((j) => ({
    name: j.name,
    location: j.location,
    making: j.making,
    rating: j.rating,
    color: j.color,
    prices: {
      "24k": baseRates["24k"].per_gram
        ? baseRates["24k"].per_gram + j.margin
        : null,
      "22k": baseRates["22k"].per_gram
        ? baseRates["22k"].per_gram + j.margin
        : null,
      "18k": baseRates["18k"].per_gram
        ? baseRates["18k"].per_gram + j.margin
        : null,
    },
    purity: {
      "24k": j.purity_24k,
      "22k": j.purity_22k,
    },
  }));
}

// ─── Main handler ───
exports.handler = async (event, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300", // 5 min browser cache
  };

  // Return cached data if fresh
  const now = Date.now();
  if (cache.data && now - cache.timestamp < CACHE_DURATION) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ ...cache.data, cached: true }),
    };
  }

  // Try primary scraper
  let goldData = await scrapeKeralaGold();

  // Fallback to BankBazaar
  if (!goldData) {
    goldData = await scrapeBankBazaar();
  }

  // If all scrapers fail, return last cached data or error
  if (!goldData) {
    if (cache.data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...cache.data,
          cached: true,
          stale: true,
          note: "Live scraping failed. Showing last known rates.",
        }),
      };
    }
    return {
      statusCode: 503,
      headers,
      body: JSON.stringify({
        error: "Unable to fetch gold rates. Please try again later.",
      }),
    };
  }

  // Generate jeweller prices from base rate
  const jewellers = generateJewellerPrices(goldData.rates);

  const response = {
    ...goldData,
    jewellers,
    cached: false,
    disclaimer:
      "Prices are indicative. Jeweller-specific rates may vary. Making charges, GST (3%) and other levies are additional. Please verify with the jeweller before purchase.",
  };

  // Update cache
  cache = { data: response, timestamp: now };

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(response),
  };
};
