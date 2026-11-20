import "./styles.css";

document.querySelector("#app").innerHTML = `
  <main class="title-screen">
    <div class="ambient ambient-one"></div>
    <div class="ambient ambient-two"></div>

    <header class="title-bar">
      <div class="wordmark"><span class="mark">M</span><span>MARKET</span></div>
      <span class="build-label">DESKTOP EDITION <i></i></span>
    </header>

    <section class="hero" aria-label="游戏标题画面">
      <div class="overline"><span></span> A PRIVATE MARKET SIMULATION <span></span></div>
      <h1>MARKET</h1>
      <p class="subtitle">随机证券市场</p>
      <div class="rule"></div>
      <p class="tagline">每一次波动，都是一个新的故事。</p>
    </section>

    <footer class="title-footer">
      <span>INDEPENDENT DESKTOP EXPERIENCE</span>
      <span>VERSION 0.1.0</span>
    </footer>
  </main>
`;
