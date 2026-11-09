# syntax=docker/dockerfile:1
FROM node:20-bookworm

# Instalar Python y dependencias
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Crear y activar virtualenv para Python
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Instalar dependencias Python (Playwright y navegadores con deps del sistema)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install --with-deps chromium

# Copiar paquetes de frontend y backend
COPY package.json ./
COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/

# Instalar dependencias Node
RUN npm ci --prefix frontend
RUN npm ci --prefix backend --include=dev

# Copiar todo el código fuente
COPY . .

# Compilar frontend y backend
RUN npm run build --prefix frontend
RUN npm run build --prefix backend

# Variables de entorno y puerto
ENV PORT=4000
ENV NODE_ENV=production
EXPOSE 4000

# Iniciar servidor backend
CMD ["npm", "start", "--prefix", "backend"]

