FROM node:20-slim AS build
WORKDIR /app

ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_DIGITAL_TWIN_URL
ENV VITE_DIGITAL_TWIN_URL=$VITE_DIGITAL_TWIN_URL
ARG VITE_NAV_URL
ENV VITE_NAV_URL=$VITE_NAV_URL
ARG VITE_ASSISTANT_BASE_URL
ENV VITE_ASSISTANT_BASE_URL=$VITE_ASSISTANT_BASE_URL

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 8080;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
