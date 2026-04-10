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
RUN sed -i 's/listen\s*80;/listen 8080;/g; s/listen\s*\[::\]:80;/listen [::]:8080;/g' /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
