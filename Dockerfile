FROM node:20.12.2

# Working Directory
WORKDIR /app

# Copy necessary project files (excluding node_modules) 
COPY package.json ./ 
COPY public ./public
COPY src ./src
COPY test/api.test.js ./ 

# Install dependencies
RUN npm install 

# Rest of your Dockerfile ... (EXPOSE, CMD)



EXPOSE 5002  
# Start Command (Assuming your entry point is index.js)
#CMD ["/bin/bash"] 
CMD ["node", "src/index.mjs"] 