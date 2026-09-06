export default async function run(page) {
  return await page.evaluate(function () {
    var d = document.getElementById("dashboardSection");
    var m = document.querySelector(".main-content");
    return {
      title: document.title,
      sections: document.querySelectorAll(".content-section").length,
      dashDisplay: getComputedStyle(d).display,
      mainOverflowY: getComputedStyle(m).overflowY,
      mainOverflowX: getComputedStyle(m).overflowX,
      bodyOverflow: getComputedStyle(document.body).overflow,
      hasFooter: !!document.querySelector(".app-footer"),
      noHorizClipping: document.documentElement.scrollWidth <= window.innerWidth
    };
  });
}
