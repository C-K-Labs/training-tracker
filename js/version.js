// Single source of truth for the app version and user-facing patch notes.
// Notes ship in Korean and English only (a deliberate maintenance decision);
// the update screens show ko for the Korean UI and en for every other locale.
// Newest entry first. The service worker cache version is bumped separately
// in sw.js at each deploy.

export const APP_VERSION = "1.3.1";

export const CHANGELOG = [
  {
    version: "1.3.1",
    date: "2026-08-11",
    notes: {
      ko: [
        "완료된 세션 편집: 기록에서 운동별 세트 무게/횟수/체감 수정, 세트 추가/삭제 (유산소 포함)",
        "첫 실행 화면에서 동기화 코드로 바로 복원 가능",
        "첫 실행 파일 가져오기가 .ttpack 파일 지원",
      ],
      en: [
        "Edit completed sessions: change set weight/reps/effort, add or delete sets in the log (cardio too)",
        "Restore with a sync code right from the first-run screen",
        "First-run file import accepts .ttpack files",
      ],
    },
  },
  {
    version: "1.3.0",
    date: "2026-08-11",
    notes: {
      ko: [
        "클라우드 백업: 코드 하나로 기기 간 백업과 복원 (기기에서 암호화되어 서버는 내용을 읽을 수 없음)",
        "피드백 보내기: 설정에서 버그 신고와 제안을 개발자에게 직접 전달",
        "파일 백업이 .ttpack 형식으로 바뀌고 아이폰에서 공유 시트로 저장 가능",
        "홈 화면 설치 안내 배너 추가",
        "업데이트 알림과 업데이트 내역 화면 추가",
      ],
      en: [
        "Cloud backup: back up and restore across devices with one code (encrypted on your device; the server cannot read it)",
        "Send feedback: report bugs and suggest improvements right from Settings",
        "File backup now uses the .ttpack format and supports the iOS share sheet",
        "Home-screen install banner",
        "Update notices and a version history screen",
      ],
    },
  },
  {
    version: "1.2.0",
    date: "2026-08-11",
    notes: {
      ko: [
        "워밍업 방식 선택: 램프(50→70%) 또는 고정",
        "운동 종류별 휴식 기본값(복합 150초/고립 90초)과 운동 사이 휴식",
        "오늘 화면에서 순서와 상관없이 운동 선택 가능",
        "중량 표기 기준 안내(바 제외/한 손/스택)와 세션 메모",
        "워밍업 중량이 본 세트에 섞이던 버그 수정",
      ],
      en: [
        "Warm-up styles: ramp (50→70%) or flat",
        "Rest defaults by exercise type (compound 150s / isolation 90s) plus between-exercise rest",
        "Pick exercises in any order on the Today screen",
        "Load-convention hints (bar excluded / per hand / stack) and session memos",
        "Fixed warm-up loads leaking into working sets",
      ],
    },
  },
  {
    version: "1.1.2",
    date: "2026-08-10",
    notes: {
      ko: [
        "일본어와 중국어 추가 (총 6개 언어)",
        "첫 실행 시 언어 선택 단계",
        "프로그램 선택 화면에 예상 소요 시간 표시",
        "기록 상세에 일일 체크 요약과 메모 표시",
      ],
      en: [
        "Japanese and Chinese added (6 languages total)",
        "Language step on first run",
        "Estimated session time on the program picker",
        "Daily-check summary and memo shown in log detail",
      ],
    },
  },
  {
    version: "1.1.1",
    date: "2026-08-06",
    notes: {
      ko: [
        "기록 상세에 미수행 표시",
        "유산소 세션 삭제 수정",
        "맨몸운동 유지 시간(초) 기록 지원",
        "통증 부위 세분화와 라이브러리 삭제 안전장치",
      ],
      en: [
        "Skipped-set marking in log detail",
        "Fixed cardio session deletion",
        "Hold-seconds logging for calisthenics",
        "Refined pain areas and safer library deletion",
      ],
    },
  },
  {
    version: "1.1.0",
    date: "2026-08-05",
    notes: {
      ko: [
        "세트 간 휴식 타이머",
        "표시 단위 선택(kg/lb)과 체중 단위 분리",
        "유산소 기록(RPE·심박·페이스), 수분·단백질·체성분 추적",
        "훈련법(피라미드·슈퍼세트·드롭세트) 지원",
        "루틴 생성기와 첫 실행 안내, 게스트 프로필",
        "영어·스페인어·포르투갈어 추가",
      ],
      en: [
        "Rest countdown between sets",
        "Display units (kg/lb) with a separate bodyweight unit",
        "Cardio logging (RPE, heart rate, pace), water, protein, and body-composition tracking",
        "Training methods (pyramid, superset, drop set)",
        "Routine generator, first-run onboarding, guest profiles",
        "English, Spanish, and Portuguese added",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-08-04",
    notes: {
      ko: ["첫 공개: 프로그램 기반 웨이트 기록, 무게 인벤토리, 진행 제안, 통계"],
      en: ["First release: program-based lifting log, weight inventory, progression suggestions, stats"],
    },
  },
];
