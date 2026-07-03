FROM apify/actor-node-playwright-chrome:18

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm ci --omit=dev

COPY . ./

CMD ["npm", "start"]
