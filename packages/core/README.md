# vite-plugin-uniapp-pages


本项目基于 [@uni-helper/vite-plugin-uni-pages](https://www.npmjs.com/package/@uni-helper/vite-plugin-uni-pages)

## 安装

```
pnpm add -D vite-plugin-uniapp-pages
```

## 使用

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import Uni from '@dcloudio/vite-plugin-uni'
import UniAppPages from 'vite-plugin-uniapp-pages'

// It is recommended to put it in front of Uni
export default defineConfig({
  plugins: [UniAppPages(), Uni()],
})
```

在pages.config中定义全局属性（ts|mts|cts|js|cjs|mjs|json），你可以在文件中使用#ifdef H5。

```ts
// pages.config.ts
import { defineUniPages } from 'vite-plugin-uniapp-pages'

export default defineUniPages({
  // pages配置vue页面配置优先级更高
  globalStyle: {
    navigationBarTextStyle: 'black',
    navigationBarTitleText: '@uni-helper',
  },
})
```

你可以使用defineRoute创建路由，需要注意的是defineRoute里面的配置不要使用变量

```vue
<script lang='ts' setup>

defineRoute({
  style: {
    navigationBarTitleText: '首页222'
  },
  tabBar: {} // 定义这个页面是Tabbar, 可以传 boolean | number | object
})

</script>

<template >
  <view>这是首页</view>
</template>

<style scoped lang='scss'>
</style>
```
