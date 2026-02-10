/**
 * 麦图助手官网 — 交互逻辑
 *
 * 功能：
 * - IntersectionObserver 驱动的滚动淡入动画
 * - 导航栏：滚动毛玻璃 + 当前 section 高亮
 * - 移动端汉堡菜单
 * - FAQ 手风琴折叠
 * - 终端打字机效果
 */

(function () {
  'use strict';

  /* ========== 滚动淡入动画 ========== */

  /**
   * 使用 IntersectionObserver 检测 .fade-in 元素进入视口
   * 进入后添加 .visible 类触发 CSS transition
   */
  function initFadeIn() {
    const elements = document.querySelectorAll('.fade-in');
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );

    elements.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ========== 导航栏滚动效果 ========== */

  /**
   * 监听滚动：
   * 1. 超过 50px 时给 nav 加 .scrolled 毛玻璃背景
   * 2. 高亮当前 section 对应的导航链接
   */
  function initNavScroll() {
    var nav = document.getElementById('nav');
    var links = document.querySelectorAll('.nav-link');
    var sections = [];

    // 收集 sections 与对应链接
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (href && href.startsWith('#')) {
        var target = document.querySelector(href);
        if (target) {
          sections.push({ el: target, link: link });
        }
      }
    });

    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;

      requestAnimationFrame(function () {
        var scrollY = window.scrollY;

        // 毛玻璃背景
        if (scrollY > 50) {
          nav.classList.add('scrolled');
        } else {
          nav.classList.remove('scrolled');
        }

        // 高亮当前 section
        var current = null;
        sections.forEach(function (s) {
          var rect = s.el.getBoundingClientRect();
          if (rect.top <= 200) {
            current = s;
          }
        });

        links.forEach(function (l) { l.classList.remove('active'); });
        if (current) {
          current.link.classList.add('active');
        }

        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ========== 移动端菜单 ========== */

  /**
   * 汉堡按钮切换导航链接的展开/收起
   */
  function initMobileMenu() {
    var toggle = document.getElementById('nav-toggle');
    var links = document.getElementById('nav-links');
    if (!toggle || !links) return;

    toggle.addEventListener('click', function () {
      links.classList.toggle('open');
    });

    // 点击链接后自动关闭
    links.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        links.classList.remove('open');
      });
    });
  }

  /* ========== FAQ 折叠 ========== */

  /**
   * 点击问题切换 .active 类
   * CSS 使用 max-height 过渡实现平滑展开/收起
   */
  function initFAQ() {
    var items = document.querySelectorAll('.faq-item');

    items.forEach(function (item) {
      var btn = item.querySelector('.faq-question');
      if (!btn) return;

      btn.addEventListener('click', function () {
        // 关闭其他
        items.forEach(function (other) {
          if (other !== item) {
            other.classList.remove('active');
          }
        });
        // 切换当前
        item.classList.toggle('active');
      });
    });
  }

  /* ========== 终端打字机效果 ========== */

  /**
   * 逐字显示终端中的对话文本
   * 使用 IntersectionObserver 当终端进入视口时触发
   */
  function initTypewriter() {
    var terminal = document.getElementById('terminal-body');
    if (!terminal) return;

    var userText = '帮我把桌面上的文件按类型整理到对应文件夹里';
    var aiText = '好的，我来帮你整理桌面文件。检测到桌面有 23 个文件，将按以下规则分类：\n\n📄 文档 → Documents/\n🖼️ 图片 → Pictures/\n📊 表格 → Spreadsheets/\n📦 其他 → Misc/\n\n确认执行吗？';
    var resultText = '已完成整理！移动了 23 个文件：\n• 文档 8 个 → Documents/\n• 图片 9 个 → Pictures/\n• 表格 4 个 → Spreadsheets/\n• 其他 2 个 → Misc/';

    var started = false;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !started) {
            started = true;
            observer.unobserve(entry.target);
            runTypewriter();
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(terminal);

    /**
     * 依次打出用户消息、AI 回复、执行结果
     */
    function runTypewriter() {
      var userEl = document.getElementById('type-user');
      var aiEl = document.getElementById('type-ai');
      var resultEl = document.getElementById('type-result');
      var aiResponse = document.getElementById('ai-response');
      var aiResult = document.getElementById('ai-result');

      typeText(userEl, userText, 40, function () {
        setTimeout(function () {
          aiResponse.style.display = '';
          typeText(aiEl, aiText, 25, function () {
            setTimeout(function () {
              aiResult.style.display = '';
              typeText(resultEl, resultText, 20, function () {
                // 完成
              });
            }, 600);
          });
        }, 500);
      });
    }

    /**
     * 逐字打出文本，支持换行符
     * @param {HTMLElement} el - 目标元素
     * @param {string} text - 要打出的文本
     * @param {number} speed - 每字延迟(ms)
     * @param {Function} callback - 完成回调
     */
    function typeText(el, text, speed, callback) {
      var i = 0;
      var cursor = document.createElement('span');
      cursor.className = 'cursor';
      el.textContent = '';
      el.appendChild(cursor);

      function tick() {
        if (i < text.length) {
          // 在光标前插入文字
          var char = text[i];
          if (char === '\n') {
            el.insertBefore(document.createElement('br'), cursor);
          } else {
            el.insertBefore(document.createTextNode(char), cursor);
          }
          i++;
          setTimeout(tick, speed);
        } else {
          // 打字完成，移除光标
          setTimeout(function () {
            if (cursor.parentNode) {
              cursor.parentNode.removeChild(cursor);
            }
            if (callback) callback();
          }, 400);
        }
      }

      tick();
    }
  }

  /* ========== 平滑锚点滚动 ========== */

  /**
   * 给所有 href="#xxx" 的锚点添加平滑滚动
   * 并考虑固定导航栏的高度偏移
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href');
        if (!href || href === '#') return;

        var target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();
        var navHeight = 64;
        var top = target.getBoundingClientRect().top + window.scrollY - navHeight;

        window.scrollTo({ top: top, behavior: 'smooth' });
      });
    });
  }

  /* ========== 初始化 ========== */

  document.addEventListener('DOMContentLoaded', function () {
    initFadeIn();
    initNavScroll();
    initMobileMenu();
    initFAQ();
    initTypewriter();
    initSmoothScroll();
  });

})();
