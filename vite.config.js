import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(async () => ({
    plugins: [react()],

    // Vite options tailored for Tauri development
    clearScreen: false, // prevent Vite from obscuring Rust compile errors
    server: {
        port: 5173,
        strictPort: true, // fail if port is taken (Tauri dev URL must match)
        watch: {
            // tell Vite to ignore watching `src-tauri`
            ignored: ["**/src-tauri/**"],
        },
    },
}));
