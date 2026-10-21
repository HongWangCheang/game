/** 季节切换：只改变袋熊森林的画面色调，不触碰计时、记录或本地学习数据。 */
(() => {
  const SEASON_KEY = 'senli-season';
  const SEASONS = [['spring', '春天'], ['summer', '夏天'], ['autumn', '秋天'], ['winter', '冬天']];
  const forest = document.getElementById('forest');
  const button = document.getElementById('season-switch');
  const name = document.getElementById('season-name');

  const readSeason = () => { try { return localStorage.getItem(SEASON_KEY); } catch { return null; } };
  const saveSeason = season => { try { localStorage.setItem(SEASON_KEY, season); } catch { /* 无痕模式等情况下只在本次页面生效 */ } };

  function applySeason(season, { persist = true } = {}) {
    const entry = SEASONS.find(([key]) => key === season) || SEASONS[1];
    forest.dataset.season = document.documentElement.dataset.season = entry[0];
    name.textContent = entry[1];
    button.setAttribute('aria-label', `切换季节，当前：${entry[1]}`);
    if (persist) saveSeason(entry[0]);
    document.dispatchEvent(new CustomEvent('season:change', { detail: { season: entry[0] } }));
  }

  button.addEventListener('click', () => {
    const index = SEASONS.findIndex(([key]) => key === forest.dataset.season);
    applySeason(SEASONS[(index + 1) % SEASONS.length][0]);
  });
  applySeason(readSeason(), { persist: false });
})();
