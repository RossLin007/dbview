# Stage 1: Build Vite frontend app (支持国内高速镜像)
FROM docker.m.daocloud.io/library/node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Stage 2: Production Nginx Server
FROM docker.m.daocloud.io/library/nginx:alpine


# Copy built static files to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
