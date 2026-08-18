# Plain Node image, not the Playwright/Chrome one: every feed this actor reads is
# fetched over plain HTTP with got-scraping and parsed with cheerio, so there is
# no browser to host. The browser image also carries a browser-sized default
# memory allocation, which meant a single run reserved the whole account
# allowance and every concurrent run failed on it.
FROM apify/actor-node:18

COPY package*.json ./
RUN npm ci --omit=dev

COPY . ./

CMD ["npm", "start"]
