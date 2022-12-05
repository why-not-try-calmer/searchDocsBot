FROM node:18-buster-slim AS builder
WORKDIR /opt/build
COPY package.json .
RUN npm install

FROM node:18-buster-slim
WORKDIR /opt/app
COPY --from=builder /opt/build/node_modules /node_modules
COPY . .
CMD ["npm", "start"]