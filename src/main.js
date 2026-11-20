import "./styles.css";
import { playTone } from "./core/audio.js";

const app = document.querySelector("#app");

app.innerHTML = `
  <main class="shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="Market 首页">
        <span class="brand-mark">M</span>
        <span>MARKET<span class="brand-muted"> / SIMULATOR</span></span>
      </a>
      <div class="topbar-right">
        <span class="status-dot"></span>
        <span>本地桌面环境</span>
        <span class="version">ENGINE PREVIEW 0.1.0</span>
      </div>
    </header>

    <section class="welcome">
      <div class="eyebrow">YOUR PRIVATE MARKET</div>
      <h1>市场，准备就绪。</h1>
      <p class="intro">桌面运行框架已经启动。这里将成为一座由随机事件、价格波动与自主决策构成的模拟证券市场。</p>
      <div class="actions">
        <button class="primary-button" id="sound-test" type="button">
          <span aria-hidden="true">♪</span> 测试音效
        </button>
        <button class="secondary-button" id="save-test" type="button">测试本地存档</button>
      </div>
      <p class="feedback" id="feedback" role="status">引擎初始化完成，等待下一步开发。</p>
    </section>

    <section class="grid">
      <article class="panel panel-large">
        <div class="panel-heading">
          <div>
            <div class="eyebrow">01 / CORE SYSTEM</div>
            <h2>引擎状态</h2>
          </div>
          <span class="tag tag-ready">ONLINE</span>
        </div>
        <div class="system-list">
          <div class="system-row"><span>桌面容器</span><strong>Electron</strong><span class="check">就绪</span></div>
          <div class="system-row"><span>界面渲染</span><strong>Chromium + Vite</strong><span class="check">就绪</span></div>
          <div class="system-row"><span>本地存档桥接</span><strong>安全 IPC</strong><span class="check">就绪</span></div>
          <div class="system-row"><span>音效模块</span><strong>Web Audio API</strong><span class="check">待测试</span></div>
        </div>
      </article>

      <article class="panel">
        <div class="eyebrow">02 / PROJECT STRUCTURE</div>
        <h2>模块化架构</h2>
        <p class="panel-copy">界面、市场规则、数据、音效与 Mod 各自独立，尽量避免互相耦合。</p>
        <div class="chips">
          <span>src /</span><span>electron /</span><span>data /</span><span>mods /</span>
        </div>
      </article>

      <article class="panel panel-wide">
        <div class="eyebrow">03 / NEXT MILESTONE</div>
        <h2>构建你的证券市场</h2>
        <div class="milestones">
          <div class="milestone done"><span>01</span><div><strong>桌面运行框架</strong><small>窗口、渲染与安全桥接</small></div><b>完成</b></div>
          <div class="milestone"><span>02</span><div><strong>市场模拟核心</strong><small>股票、随机行情、交易日推进</small></div><b>待开发</b></div>
          <div class="milestone"><span>03</span><div><strong>Mod 与存档管理</strong><small>导入、启用、配置与持久化</small></div><b>待开发</b></div>
        </div>
      </article>
    </section>

    <footer class="footer">
      <span>MARKET SIMULATOR</span>
      <span>BUILT FOR EXPERIMENTATION</span>
    </footer>
  </main>
`;

const feedback = document.querySelector("#feedback");

document.querySelector("#sound-test").addEventListener("click", async () => {
  try {
    await playTone(660, 0.12);
    feedback.textContent = "音效模块正常。";
  } catch (error) {
    feedback.textContent = "音效播放失败：" + error.message;
  }
});

document.querySelector("#save-test").addEventListener("click", async () => {
  try {
    if (!window.gameHost?.save) throw new Error("桌面存档接口不可用");
    const payload = { testedAt: new Date().toISOString(), engine: "0.1.0" };
    await window.gameHost.save.write("engine-test", payload);
    const restored = await window.gameHost.save.read("engine-test");
    feedback.textContent = restored?.engine === "0.1.0"
      ? "本地存档读写正常。"
      : "存档写入完成，但读取验证未通过。";
  } catch (error) {
    feedback.textContent = "存档测试失败：" + error.message;
  }
});
