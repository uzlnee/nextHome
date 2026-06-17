# Next Home

재개발 구역·매물 비교 웹앱입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속.

## 빌드

```bash
npm run build
```

`dist/` 폴더에 정적 파일이 생성됩니다.

## 배포 (Vercel 기준)

1. 이 폴더를 GitHub 리포지토리에 push
2. https://vercel.com 에서 GitHub 리포지토리 import
3. Framework Preset: Vite (자동 감지됨) → Deploy

Netlify를 쓰는 경우 Build command는 `npm run build`, Publish directory는 `dist`로 설정하면 됩니다.

## 다음 단계: 카카오 로그인 + 데이터 영구 저장 (Supabase)

지금 버전은 화면을 새로고침하면 입력한 데이터가 사라져요. Supabase + 카카오 로그인을 연동하면 로그인한 사용자별로 데이터가 영구 저장됩니다.

1. `.env.example`을 `.env`로 복사
2. Supabase 프로젝트의 Project URL / anon public key를 `.env`에 채워넣기
3. 이후 Supabase 클라이언트 연결 코드, 카카오 로그인 버튼, 구역/매물 데이터를 DB와 연동하는 코드가 추가될 예정입니다.

## 폴더 구조

```
nexthome-app/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.example
└── src/
    ├── main.jsx       # 진입점
    ├── App.jsx        # 전체 앱 (현재 모든 화면이 이 파일에 들어있어요)
    └── index.css      # Tailwind 진입 CSS
```
