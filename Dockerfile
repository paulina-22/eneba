FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./

ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM php:8.3-apache

RUN docker-php-ext-install pdo_mysql \
    && find /etc/apache2/mods-enabled -maxdepth 1 -name 'mpm_*.load' ! -name 'mpm_prefork.load' -delete \
    && find /etc/apache2/mods-enabled -maxdepth 1 -name 'mpm_*.conf' ! -name 'mpm_prefork.conf' -delete \
    && a2enmod mpm_prefork rewrite \
    && test "$(apache2ctl -M 2>&1 | grep -c 'mpm_.*_module')" -eq 1 \
    && printf '%s\n' \
        '<Directory /var/www/html>' \
        '    AllowOverride All' \
        '    Require all granted' \
        '</Directory>' \
        > /etc/apache2/conf-available/gamebay.conf \
    && a2enconf gamebay

COPY backend/public/ /var/www/html/
COPY backend/src/ /var/www/src/
COPY --from=frontend-build /app/frontend/dist/ /var/www/html/
COPY backend/docker-entrypoint.sh /usr/local/bin/gamebay-entrypoint
RUN chmod +x /usr/local/bin/gamebay-entrypoint

EXPOSE 8080
CMD ["gamebay-entrypoint"]
