# Base Image (支持国内高速镜像，使用 Node 22 满足 Supabase 原生 WebSocket 需求)
FROM docker.m.daocloud.io/library/node:22-alpine



# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy backend source code
COPY . .

# Expose backend port
EXPOSE 3001

# Command to run server
CMD ["node", "server.js"]
