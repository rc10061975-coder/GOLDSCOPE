# GoldScope — Gold Price Comparison Platform

## Project Structure

```
goldscope/
├── netlify.toml              # Netlify config (functions + redirects)
├── package.json              # Dependencies (cheerio, node-fetch)
├── public/
│   └── index.html            # Frontend (single-page site)
└── netlify/
    └── functions/
        └── gold-rates.js     # Serverless scraper function
```

## How It Works

1. **Frontend** (`public/index.html`) loads and calls `/api/gold-rates`
2. **Netlify Function** (`netlify/functions/gold-rates.js`) scrapes KeralaGold.com for live 22K gold rates
3. Function calculates 24K and 18K rates from the 22K base
4. Jeweller-specific prices are generated with realistic margin offsets
5. Results are cached for 5 minutes to avoid hitting source sites too often
6. If scraping fails, it falls back to BankBazaar, then to cached data

## Deployment to Netlify

### Option 1: Git-based deploy (recommended)

1. Push this folder to a GitHub/GitLab repo
2. Go to https://app.netlify.com → "Add new site" → "Import an existing project"
3. Connect your repo
4. Netlify auto-detects the config and deploys

### Option 2: Netlify CLI

```bash
npm install -g netlify-cli
cd goldscope
npm install
netlify deploy --prod
```

## Important Notes

- **Scraping limitations**: KeralaGold.com may change their HTML structure, which would break the scraper. Monitor and update the parsing logic as needed.
- **Jeweller margins**: Currently using estimated margin offsets. Replace with real data from jeweller partnerships for accuracy.
- **Rate limits**: The function caches for 5 minutes. Don't reduce this below 2 minutes to avoid getting blocked.
- **Legal**: Review the terms of service of any site you scrape. Consider reaching out for data partnerships.

## Customisation

- To add/remove jewellers: Edit the `generateJewellerPrices()` function in `gold-rates.js`
- To change the scrape source: Modify `scrapeKeralaGold()` or add new scraper functions
- To adjust cache duration: Change `CACHE_DURATION` in `gold-rates.js`
