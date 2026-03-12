# 🇰🇷 외국인 눈으로 본 한국 주식 — 매력도 분석

> "외국인 투자자는 지금 한국 주식을 얼마나 매력적으로 볼까?"  
> 환율·환헤지 비용·세금까지 반영한 **USD 기준 실질 체감 가격**을 계산하는 웹 도구입니다.

---

## 🌐 라이브 데모

GitHub Pages 배포 후 링크 추가 예정

---

## 📌 주요 기능

| 기능 | 설명 |
|------|------|
| **외국인 매력도 점수** | 환율·금리·비용을 종합해 100점 만점 점수 산출 |
| **실시간 환율** | 3개 무료 API 자동 폴백 (API 실패 시 수동 입력) |
| **비용 시각화** | 환헤지·거래세·배당세 구성 비율 막대 차트 |
| **종목별 계산기** | KRX 종목 원화 가격 입력 → USD 체감가 즉시 계산 |
| **파라미터 조정** | 금리·세율·보유기간 직접 수정 가능 |

---

## 💰 반영되는 비용 항목

```
외국인 체감가 = USD 환산가
             + 환헤지 비용   (한미 금리차 × 보유기간)
             + 증권거래세    (매수 + 매도, 각 0.18%)
             + 배당 원천징수 영향 (배당수익률 × 세율 × 보유기간)
```

### 각 항목 설명

- **환헤지 비용 (스왑포인트)**: 커버드 금리 평가(CIP) 기반. 미국 금리 > 한국 금리일 때 발생. 현재 약 1~2%/년 수준
- **증권거래세**: KOSPI 0.18%, KOSDAQ 0.18%. 미국(0%), 일본(0%) 대비 불리
- **배당 원천징수세**: 외국인 배당 수령 시 원천징수. 한미 조세조약 기준 15%

---

## 🔌 환율 API (자동 폴백)

| 순위 | 소스 | CORS | 한도 |
|------|------|------|------|
| 1순위 | [jsdelivr CDN (fawazahmed0)](https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json) | ✅ 완전 허용 | 무제한 |
| 2순위 | [exchangerate-api.com](https://api.exchangerate-api.com/v4/latest/USD) | ✅ 허용 | 월 1,500회 |
| 3순위 | [open.er-api.com](https://open.er-api.com/v6/latest/USD) | ✅ 허용 | 월 1,500회 |

> 3개 API 모두 실패 시 수동 입력 UI가 자동으로 노출됩니다.

---

## 🗂️ 프로젝트 구조

```
kr-stock-foreign-view/
├── index.html          # 메인 HTML
├── src/
│   ├── style.css       # 스타일시트
│   └── main.js         # 핵심 로직 (환율 fetch, 계산, 렌더링)
├── .gitignore
└── README.md
```

---

## 🚀 로컬 실행

```bash
git clone https://github.com/YOUR_USERNAME/kr-stock-foreign-view.git
cd kr-stock-foreign-view

# 방법 1: Python 내장 서버 (CORS 이슈 없음)
python3 -m http.server 8080
# → http://localhost:8080 접속

# 방법 2: Node.js live-server
npx live-server

# 방법 3: VS Code Live Server 확장 사용
```

> ⚠️ `file://` 프로토콜로 직접 열면 CORS 정책으로 환율 API 호출이 실패할 수 있습니다.  
> 반드시 로컬 HTTP 서버를 통해 실행하세요.

---

## 🌍 GitHub Pages 배포

```bash
# 1. GitHub에 저장소 생성 후 push
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/kr-stock-foreign-view.git
git push -u origin main

# 2. GitHub 저장소 → Settings → Pages
#    Source: Deploy from a branch
#    Branch: main / (root)
#    → Save

# 3. 약 1분 후 https://YOUR_USERNAME.github.io/kr-stock-foreign-view 접속
```

---

## ⚙️ 파라미터 기본값

| 항목 | 기본값 | 설명 |
|------|--------|------|
| 한국 기준금리 | 3.0% | BOK 기준금리 |
| 미국 기준금리 | 4.5% | Fed Funds Rate |
| 증권거래세 | 0.18% | KOSPI 기준 |
| 배당 원천징수 | 15% | 한미 조세조약 |
| 보유기간 | 12개월 | 환헤지 비용 산출 기준 |
| 배당수익률 | 2.0% | 시장 평균 추정치 |

---

## ⚠️ 면책 조항

본 도구는 **교육 및 정보 제공 목적**으로 제작되었습니다.  
계산 결과는 추정값이며 실제 투자 비용·수익과 다를 수 있습니다.  
실제 투자 결정 시 전문가 자문을 받으시기 바랍니다.

---

## 📄 라이선스

MIT License
