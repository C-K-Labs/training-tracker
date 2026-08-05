// i18n dictionary layer. Korean is the primary language; en/es/pt are
// planned slots that fall back to Korean until translated.
// Screens must resolve every UI string through t(); no hardcoded literals.

const ko = {
  "app.title": "트레이닝 트래커",

  "tab.today": "오늘",
  "tab.log": "기록",
  "tab.stats": "통계",
  "tab.settings": "설정",

  "screen.today.sub": "{date} · {session}",
  "screen.today.sub.idle": "{date}",
  "screen.log.sub": "모든 세션",
  "screen.stats.sub": "추이와 밸런스",
  "screen.settings.sub": "무게 · 프로그램 · 데이터",

  "common.done": "완료",
  "common.cancel": "취소",
  "common.save": "저장",
  "common.delete": "삭제",
  "common.edit": "편집",
  "common.close": "닫기",
  "common.add": "추가",
  "common.back": "뒤로",
  "common.confirm": "확인",
  "common.delete.confirm": "{name}을(를) 삭제할까요?",
  "common.waiting": "대기",
  "common.none": "없음",
  "common.today": "오늘",
  "common.bodyweight.load": "맨몸",
  "common.reps": "회",
  "common.sets": "세트",
  "common.set.n": "{n}세트",
  "common.warmup": "워밍업",
  "common.max.reps": "최대",

  "kind.weights": "웨이트",
  "kind.run": "러닝",
  "kind.calisthenics": "맨몸운동",
  "kind.bodyweight": "체중",
  "kind.all": "전체",

  "effort.hard": "힘듦",
  "effort.normal": "보통",
  "effort.easy": "여유",

  "bodypart.legs": "다리",
  "bodypart.back": "등",
  "bodypart.chest": "가슴",
  "bodypart.shoulders": "어깨",
  "bodypart.arms": "팔",
  "bodypart.core": "코어",
  "bodypart.full": "전신",

  "equipment.dumbbell": "덤벨",
  "equipment.barbell": "바벨",
  "equipment.smith": "스미스머신",
  "equipment.cable": "케이블",
  "equipment.machine": "머신",
  "equipment.bodyweight": "맨몸",

  "today.start.title": "세션 시작",
  "today.start.pick": "프로그램 선택",
  "today.start.empty": "프로그램이 없습니다. 설정에서 프로그램 팩을 임포트하거나 세션을 직접 만들어 주세요.",
  "today.start.button": "세션 시작",
  "today.start.free": "자유 세션",
  "today.recovery.title": "리커버리 모드 · {week}주차",
  "today.recovery.badge": "83% 적용",
  "today.recovery.desc": "{days}일 공백이 감지되어 복귀 중량을 마지막 기록의 {pct}%로 낮췄습니다. 2주차까지 유지하고 3주차에 원래 중량으로 복귀합니다.",
  "today.recovery.exit": "일반 모드로 전환",
  "today.recovery.enter": "리커버리 모드 켜기",
  "today.recovery.suggest": "마지막 세션에서 {days}일이 지났습니다. 리커버리 모드로 시작할까요?",
  "today.daily.title": "일일 체크",
  "today.daily.sleep": "수면 {h}시간",
  "today.daily.condition": "컨디션 {v}/5",
  "today.daily.pain": "{area} 통증 {v}/3",
  "today.daily.heat": "더위 보정",
  "today.daily.protein": "단백질 목표 확인",
  "today.daily.note": "메모",
  "today.daily.edit": "일일 체크 입력",
  "today.session.title": "{name} · {sets}세트",
  "today.set.done": "세트 완료",
  "today.set.record": "{w} × {r}회",
  "today.exercise.finish": "다음 운동",
  "today.session.finish": "세션 종료",
  "today.session.finished": "세션이 저장되었습니다",
  "today.suggest.increase": "증량 안내: 다음 세션에 {load} 제안 (전 세트 여유)",
  "today.suggest.hold": "유지: 현재 중량 반복",
  "today.suggest.decrease": "감량 제안: {load} (2세션 연속 횟수 미달)",
  "today.suggest.recovery": "리커버리 중에는 중량을 유지합니다",
  "today.timer.label": "경과 시간",
  "today.weight.unit.lb": "LB",
  "today.weight.unit.kg": "KG",
  "today.run.title": "러닝 기록",
  "today.run.minutes": "시간(분)",
  "today.run.hr": "평균 심박",
  "today.run.pace": "페이스/속도",
  "today.cal.title": "맨몸운동 기록",
  "today.cal.hold": "홀드(초)",
  "today.bw.title": "체중 기록",
  "today.bw.kg": "체중(kg)",
  "today.bw.fasted": "공복 측정",
  "today.other.add": "다른 기록 추가",
  "today.cal.pick": "운동 선택",
  "today.recovery.suggest.title": "공백 감지",
  "today.session.allDone": "모든 운동을 마쳤습니다",

  "log.empty": "아직 기록이 없습니다. 첫 세션을 시작해 보세요.",
  "log.delete.confirm": "이 기록을 삭제할까요?",
  "log.month": "{y}년 {m}월",
  "log.recovery": "리커버리",
  "log.sets.summary": "{sets}세트 · {min}분",
  "log.effort.summary": "여유 {e} 보통 {n} 힘듦 {h}",
  "log.run.summary": "{min}분 · 평균 {hr}bpm",
  "log.bw.summary": "{kg} kg",

  "stats.weight.title": "체중",
  "stats.weight.cap": "{date} · 공복 측정",
  "stats.weight.cap.notfasted": "{date}",
  "stats.week.title": "이번 주 세션",
  "stats.week.cap": "월요일 시작 기준",
  "stats.trend.title": "중량 추이",
  "stats.trend.empty": "이 운동의 기록이 아직 없습니다",
  "stats.trend.none": "웨이트 기록이 있는 운동이 아직 없습니다",
  "unit.kg": "kg",
  "stats.balance.title": "주간 볼륨 밸런스 · 이번 주",
  "stats.balance.cap": "점선 구간이 권장 범위 {lo}~{hi}세트입니다.",
  "stats.balance.sets": "{n}세트",
  "stats.overshoot": "{name}: 최근 한 달 증량률이 {pct}%로 권장(월 2~3%)을 크게 넘습니다. 과속 주의.",

  "settings.inventory.title": "보유 무게",
  "settings.inventory.dumbbell": "덤벨",
  "settings.inventory.dumbbell.desc": "{min}~{max} lb · 목록 편집",
  "settings.inventory.plate": "스미스 · 바벨 플레이트",
  "settings.inventory.plate.desc": "최소 {min} lb → {step} lb 증분 · 봉 무게 제외",
  "settings.inventory.cable": "케이블 스택",
  "settings.inventory.cable.desc": "{step} kg 증분",
  "settings.inventory.overrides": "기구별 예외",
  "settings.inventory.overrides.desc": "{n}개",
  "settings.program.title": "프로그램",
  "settings.program.name": "프로그램 이름",
  "settings.program.new": "새 프로그램",
  "settings.program.item.load": "목표 중량",
  "settings.program.recovery.days": "공백 기준(일)",
  "settings.program.recovery.factor": "복귀 비율(%)",
  "settings.program.library.name": "운동 이름",
  "settings.program.library.variant": "변형",
  "settings.program.library.spinal": "척추 부하 운동",
  "settings.program.sessions": "세션 편집",
  "settings.program.library": "운동 라이브러리",
  "settings.program.library.desc": "{n}종 · 변형 포함",
  "settings.program.recovery": "리커버리 규칙",
  "settings.program.recovery.desc": "공백 {days}일 이상 감지 시 {pct}% 적용",
  "settings.data.title": "데이터",
  "settings.data.import": "프로그램 팩 임포트",
  "settings.data.import.desc": "JSON: 운동 + 프로그램 + 과거 기록",
  "settings.data.import.mode": "임포트 방식",
  "settings.data.import.replace": "전체 교체",
  "settings.data.import.replace.confirm": "기존 데이터를 모두 지우고 교체합니다. 계속할까요?",
  "settings.data.import.merge": "병합",
  "settings.data.import.ok": "임포트 완료: 운동 {e} · 프로그램 {p} · 세션 {s}",
  "settings.data.import.err": "임포트 실패: 파일 형식이 올바르지 않습니다",
  "settings.data.export": "전체 기록 내보내기",
  "settings.data.export.desc": "마지막 백업: {date}",
  "settings.data.export.never": "백업 이력 없음",
  "settings.display.title": "표시",
  "settings.display.lang": "언어",
  "settings.display.lang.desc": "영어 · 스페인어 · 포르투갈어 예정",
  "settings.display.theme": "테마",
  "settings.theme.system": "시스템",
  "settings.theme.light": "라이트",
  "settings.theme.dark": "다크",
  "settings.display.unit": "표시 단위",
  "settings.display.unit.both": "둘다",
  "settings.saved": "저장되었습니다",

  "settings.inventory.machine": "머신 스택",
  "settings.inventory.machine.desc": "{step} lb 증분",
  "settings.inventory.dumbbell.owned": "보유 덤벨",
  "settings.inventory.range.min": "최소",
  "settings.inventory.range.max": "최대",
  "settings.inventory.range.step": "단위",
  "settings.inventory.range.generate": "생성",
  "settings.inventory.manual.add": "직접 추가",

  "settings.rest.title": "휴식 기본값",
  "settings.rest.hint": "권장: 컴파운드 2~3분, 고립 1~1.5분",
  "settings.rest.seconds": "휴식 시간",
  "settings.rest.overrides": "운동별 휴식",
  "settings.rest.overrides.desc": "{n}개",

  "rest.title": "휴식",
  "rest.next": "다음: {name} {n}세트",
  "rest.add30": "+30초",
  "rest.skip": "건너뛰기",

  "lang.ko": "한국어",
  "lang.en": "English",
  "lang.es": "Español",
  "lang.pt": "Português",
};

const dictionaries = { ko, en: {}, es: {}, pt: {} };
let current = "ko";

export function setLang(lang) {
  if (dictionaries[lang]) current = lang;
}

export function getLang() {
  return current;
}

export function availableLangs() {
  return Object.keys(dictionaries);
}

export function t(key, params) {
  let str = dictionaries[current][key] ?? ko[key];
  if (str === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
