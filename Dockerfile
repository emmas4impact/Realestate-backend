FROM node:22-alpine3.18

# Working Directory
WORKDIR /app

COPY package.json ./ 
COPY public ./public
COPY src ./src
COPY test/listings.test.mjs ./ 
COPY test/tenants.test.mjs ./ 
COPY test/users.test.mjs ./ 

RUN npm install 

EXPOSE 5005

CMD ["node", "src/index.mjs"] 
