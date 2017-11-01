/**
 * 图片加载器
 *
 * @version 1.2.0
 */

import validation from '@~lisfan/validation'
import VueLogger from '@~lisfan/vue-logger'
import { addAnimationEnd, removeAnimationEnd } from './utils/animation-handler'

let ImageLoad = {} // 插件对象
const DIRECTIVE_NAMESPACE = 'image-loader' // 指令名称
const PLUGIN_TYPE = 'directive'

// 透明图片base64
const PLACEHOLDER_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAABBJREFUeNpi/P//PwNAgAEACQEC/2m8kPAAAAAASUVORK5CYII='

// 私有方法
const _actions = {
  /**
   * 设置图片地址
   * @param {element} $el - 目标dom元素
   * @param {string} imgSrc - 图片地址
   */
  setImageSrc($el, imgSrc) {
    if ($el.nodeName === 'IMG') {
      $el.setAttribute('src', imgSrc)
    } else {
      $el.style.backgroundImage = 'url("' + imgSrc + '")'
    }
  },
  /**
   * 请求图片资源
   *
   * @param {element} $el - 目标dom元素
   * @param {string} imgSrc - 请求图片地址
   * @param {boolean} animate - 全局配置，是否进行动效
   * @param {Vue} vm - vue实例
   * @param {VueLogger} vueLogger - logger日志
   */
  requestImage($el, imgSrc, animate, vm, vueLogger) {
    // 1. 判断是否正在请求**占位图片**的步骤，若请求占位图片也失败，则使用**透明图片**代替占位
    // 2. 如果动态图片地址和占位图片地址相同，则直接认为是在请求占位图片的步骤
    $el.isRequestPHImage = false

    if (imgSrc === $el.phImageSrc) {
      $el.isRequestPHImage = true
    }

    let $image = new Image()
    $image.src = imgSrc
    $el.currentImgSrc = imgSrc

    // 如果这张图片已下载过，且未开启强制动效，则判断图片已加载完毕，否则将进行动效载入
    if ($image.complete && !$el.enableForceEffect) {
      $el.imageComplete = true
    } else {
      $el.imageComplete = false
    }

    // 判断dom元素标签名，若为img标签元素，则设置透明图片占位，否则设置为该元素的背景
    _actions.setImageSrc($el, PLACEHOLDER_IMAGE)

    // 为dom元素绑定动画结束事件
    if (animate && $el.animationClassName) {
      // 若已绑定则不再重复绑定
      const animationEndHandler = function () {
        const enterEndClassNameList = $el.originClassNameList.slice()
        enterEndClassNameList.push($el.animationClassName + '-enter-end')
        $el.setAttribute('class', enterEndClassNameList.join(' ').trim())

        // 动画结束后移除绑定事件
        removeAnimationEnd($el, animationEndHandler)
      }

      // 为节点绑定动画结束事件
      addAnimationEnd($el, animationEndHandler)
    }

    $image.addEventListener('load', _actions.successHandler($el, $image, animate, vm, vueLogger))

    $image.addEventListener('error', _actions.failHandler($el, $image, vm, vueLogger))
  },
  /**
   * 图片请求成功事件
   * @param {element} $el - 目标dom元素
   * @param {element} $image - 虚拟图片元素
   * @param {boolean} animate - 全局配置，是否进行动效
   * @param {Vue} vm - vue实例
   * @param {VueLogger} vueLogger - logger日志
   */
  successHandler($el, $image, animate, vm, vueLogger) {
    return function () {
      // 性能优化：图片延迟加载，不要在同一时间内同时加载
      requestAnimationFrame(() => {
        vueLogger.log(vm, 'image load successed:', $el.currentImgSrc)

        $image = null // 销毁

        // 设置图片地址
        _actions.setImageSrc($el, $el.currentImgSrc)

        // 图片未加载完毕，且开启了动效，且存在动效名称时，才进行动画
        if (!$el.imageComplete && animate && $el.animationClassName) {
          vueLogger.log(vm, 'animation ing...')

          const enterClassNameList = $el.originClassNameList.slice()
          enterClassNameList.push($el.animationClassName + '-enter')
          $el.setAttribute('class', enterClassNameList.join(' ').trim())

          // 置于下一帧
          requestAnimationFrame(() => {
            const enterActiveClassNameList = $el.originClassNameList.slice()
            enterActiveClassNameList.push($el.animationClassName + '-enter-active')
            $el.setAttribute('class', enterActiveClassNameList.join(' ').trim())
          })
        }
      })
    }
  },
  /**
   * 图片请求失败事件
   * @param {element} $el - 目标dom元素
   * @param {element} $image - 虚拟图片元素
   * @param {Vue} vm - vue实例
   * @param {VueLogger} vueLogger - logger日志
   */
  failHandler($el, $image, vm, vueLogger) {
    return function () {
      vueLogger.log(vm, 'image load faild:', $el.currentImgSrc)

      // 如果是二次加载图片且又失败
      // 则使用透明图片代替
      if (!$el.isRequestPHImage) {
        $el.currentImgSrc = $el.phImageSrc
        $image.src = $el.currentImgSrc
        $el.isRequestPHImage = true
      } else {
        $el.currentImgSrc = PLACEHOLDER_IMAGE
        $image.src = $el.currentImgSrc
        // $image = null // 销毁
      }
      //
      // // 如果这张图片已下载过，且开启强制动效
      // if ($image.complete && !$el.enableForceEffect) {
      //   $el.imageComplete = true
      // } else {
      //   $el.imageComplete = false
      // }
    }
  }
}

/**
 * 暴露install钩子，供vue注册
 * @param {Vue} Vue - Vue构造器类
 * @param {object} [options={}] - 配置选项
 * @param {number} [options.debug=false] - 是否开启日志调试模式，默认关闭
 * @param {number} [options.remRatio=100] - rem与px的比便关系，默认值为100，表示1rem=100px
 * @param {number} [options.animate=true] - 是否启用动效载入，全局性动效开关，比如为了部分机型，可能会关闭动效的展示，默认开启
 * @param {number} [options.force=false] - 是否强制开启每次指令绑定或更新进行动效展示，默认关闭：图片只在初次加载成功进行特效载入，之后不进行特效加载。需要同时确保animate是启用true
 */
ImageLoad.install = function (Vue, {
  debug = false,
  remRatio = 100,
  animate = true,
  force = false,
} = {}) {
  const vueLogger = new VueLogger({
    name: `${PLUGIN_TYPE}-${DIRECTIVE_NAMESPACE}`,
    debug
  })

  /**
   * image-loader 指令
   *
   * @param {number} [arg=false] - 参数
   * @param {number} [value=false] - 值
   * @param {number} [modifiers] - 修饰符
   * @param {number} [modifiers.force=false] - 启用每次指令绑定或更新进行动效展示修饰符
   */
  Vue.directive(DIRECTIVE_NAMESPACE, {
    /**
     * 初始绑定
     * @param {Element} $el - 目标dom元素
     * @param {object} binding - 指令对象
     * @param {VNode} vnode - vue节点对象
     */
    bind($el, binding, vnode) {
      vueLogger.log(vnode.context, 'emit bind hook!')

      // 在目标节点上绑定该指令标识
      $el.setAttribute(`v-${DIRECTIVE_NAMESPACE}`, '')

      // 在dom实例上绑定一些初次绑定保存的数据
      // 保存默认占位图片的值
      $el.phImageSrc = $el.getAttribute('placeholder') || ''
      $el.imageSrc = $el.getAttribute('image-src') || ''

      // 保存原dom元素class类名
      const originClassName = $el.getAttribute('class') || ''
      $el.originClassNameList = originClassName.split(' ')

      // 自定义动画类
      $el.animationClassName = binding.value || ''

      // 是否强制开启每次载入动效
      $el.enableForceEffect = binding.modifiers.force || force

      // 是否自定义了高宽值
      let sizeList = []

      if (binding.arg) {
        sizeList = binding.arg.split('x')
      }

      // 只截取前两个的值
      let [width, height] = sizeList.slice(0, 2)

      height = height || width

      // 设置目标元素的高宽
      // [注]：他拉伸的是直接的元素高度，不不会自适应缩放
      // 减少重绘，注意留空
      if (width && height) {
        const widthStyle = (width / remRatio ) + 'rem'
        const heightStyle = (height / remRatio ) + 'rem'
        $el.style = `width:${widthStyle}; height:${heightStyle}; ` + $el.style
        vueLogger.log(vnode.context, 'width:', widthStyle)
        vueLogger.log(vnode.context, 'height:', heightStyle)
      }

      vueLogger.log(vnode.context, 'force animation effect:', $el.enableForceEffect)
      vueLogger.log(vnode.context, 'animationClass:', $el.animationClassName)
      vueLogger.log(vnode.context, 'image src:', $el.imageSrc)
      vueLogger.log(vnode.context, 'placeholder image src:', $el.phImageSrc)

      if (validation.isEmpty($el.imageSrc)) {
        vueLogger.log(vnode.context, 'image src no existed, request placeholder image source!')
        _actions.requestImage($el, $el.phImageSrc, animate, vnode.context, vueLogger)
      } else {
        vueLogger.log(vnode.context, 'image src existed, request image source!')
        _actions.requestImage($el, $el.imageSrc, animate, vnode.context, vueLogger)
      }
    },
    /**
     * 值进行了更新
     * @param {Element} $el - 目标dom元素
     * @param {object} binding - 指令对象
     * @param {VNode} vnode - vue节点对象
     */
    update($el, binding, vnode) {
      vueLogger.log(vnode.context, 'emit update hook!')

      const newImageSrc = $el.getAttribute('image-src') || ''
      // 当图片地址有变化时，重新请求图片
      if ($el.imageSrc !== newImageSrc) {
        // 若强制启用了动效，则每次图片显示，都会执行动效
        vueLogger.log(vnode.context, 'image src updated, request image source again!')
        $el.imageSrc = newImageSrc
        _actions.requestImage($el, newImageSrc, animate, vnode.context, vueLogger)
      }
    }
  })
}

export default ImageLoad
