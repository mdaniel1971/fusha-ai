# Use Node.js 24 as base image
FROM node:24-bookworm

# Install system dependencies
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    git \
    curl \
    ca-certificates \
    gnupg \
    && apt-get clean -y && rm -rf /var/lib/apt/lists/*

# Install Supabase CLI
RUN curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz \
    && mv supabase /usr/local/bin/supabase \
    && chmod +x /usr/local/bin/supabase

# Set working directory
WORKDIR /workspace

# Configure git (will be overridden by VS Code with your actual git config)
RUN git config --global --add safe.directory /workspace

# Keep container running
CMD ["sleep", "infinity"]