# Use Node.js 20 slim image as base
FROM node:20-slim

# Create and define the application directory
WORKDIR /app

# Copy package files separately to leverage Docker cache
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Expose the port from .env
EXPOSE 4081

# Start the application
CMD ["npm", "start"]
