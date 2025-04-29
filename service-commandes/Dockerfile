# Use an official Node.js runtime as a parent image (Alpine version for smaller size)
FROM node:lts-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json (if available) 
# Using wildcard to handle both cases (npm install/ci)
COPY package*.json ./

# Install production dependencies using npm ci (clean install based on lock file)
# If package-lock.json is not present, npm ci will fail. Use npm install in that case.
RUN npm ci --omit=dev

# Bundle app source
COPY . .

# Make port 3002 available to the world outside this container
EXPOSE 3002

# Define environment variable (optional, can be set at runtime)
# ENV NODE_ENV production 

# Run index.js when the container launches
CMD [ "node", "index.js" ]
