# Use Node.js as the base image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port used by Vite
EXPOSE 4321

# Start the application in development mode
# --host 0.0.0.0 allows access from outside the container
# --port 4321 ensures it runs on your requested port
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4321"]
