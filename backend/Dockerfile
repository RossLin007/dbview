# Base Image (支持国内高速镜像)
FROM docker.m.daocloud.io/library/node:22-alpine



# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev --registry=https://registry.npmmirror.com

# Copy backend source code
COPY . .

# Expose backend port
EXPOSE 3301


# Command to run server
CMD ["node", "server.js"]
