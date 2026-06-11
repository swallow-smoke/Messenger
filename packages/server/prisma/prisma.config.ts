import { defineConfig } from '@prisma/config';

export default defineConfig({
    datasource: {
        url: process.env.DATABASE_URL, // 마이그레이션 시 사용할 DB URL
    },
});