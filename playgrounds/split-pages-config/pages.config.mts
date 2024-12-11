import { defineUniPages } from '@twoke/vite-plugin-uniapp-pages'

export default defineUniPages({
  "pages": [
    {
      path: "pages/index/index"
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "white",
    "navigationBarBackgroundColor": "#8f60df",
    "backgroundColor": "#F8F8F8",
    "app-plus": {
      "pullToRefresh": {
        "style": "circle",
        "color": "#8f60df"
      },
      "bounce": "none"
    }
  },
  "easycom": {
    "autoscan": true,
    "custom": {
      "^uni-(.*)": "@dcloudio/uni-ui/lib/uni-$1/uni-$1.vue"
    }
  },
  "tabBar": {
    "color": "#8f60df",
    "selectedColor": "#8f60df",
    "backgroundColor": "#fafafa"
  }
})
