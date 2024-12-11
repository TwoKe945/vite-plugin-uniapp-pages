import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import { UniAppPages } from "@twoke/vite-plugin-uniapp-pages";



// https://vitejs.dev/config/
export default defineConfig({
  plugins: [uni(), UniAppPages({
    debug: ['pages', 'subPages', 'cache'],
    subPackages: ['sub-pages']
  })]
});
