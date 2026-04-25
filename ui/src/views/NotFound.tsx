import { Component } from 'solid-js'
import { A } from '@solidjs/router'

const NotFoundView: Component = () => {
  return (
    <div class="flex flex-col items-center justify-center min-h-[60vh]">
      <h1 class="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <p class="text-xl text-gray-600 mb-8">页面未找到</p>
      <A
        href="/"
        class="px-6 py-3 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
      >
        返回首页
      </A>
    </div>
  )
}

export default NotFoundView
