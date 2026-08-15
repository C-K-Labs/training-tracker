// Single source of truth for the app version and user-facing patch notes.
// Notes ship in all six UI languages (ko en es pt ja zh); the update notice
// and the settings version history pick the active language and fall back to
// English. The i18n parity test asserts every entry covers every language.
// Newest entry first. The service worker cache version is bumped separately
// in sw.js at each deploy.

export const APP_VERSION = "1.8.0";

export const CHANGELOG = [
  {
    version: "1.8.0",
    date: "2026-08-15",
    notes: {
      ko: [
        "휴식 바 버튼 라벨이 밀려 '건너뛰기'가 두 개로 보이던 문제 수정 (-30초/+30초/건너뛰기 복구)",
        "휴식 중에 다른 운동의 세트를 기록해도 진행 중인 휴식 타이머가 초기화되지 않습니다",
        "다른 탭을 다녀와도 진행 중이던 운동 선택이 유지되고, 휴식 바를 탭하면 진행 중인 운동으로 바로 이동합니다",
        "기록한 세트의 힘듦도 수정할 수 있고, 세션 중 일일 체크 카드가 접이식이 되었습니다",
        "기록 탭이 월별로 접히고, 통계의 중량 추이 종목 선택이 부위별 목록으로 바뀌었습니다",
        "개인 팩으로 가져온 운동 이름도 앱 언어를 따라가고, 앱 시작 시 로고 스플래시가 표시됩니다",
      ],
      en: [
        "Fixed the rest-bar button labels being shifted so 'Skip' appeared twice (-30s/+30s/Skip restored)",
        "Logging a set for a different exercise no longer resets a running rest timer",
        "Your picked exercise survives visiting other tabs, and tapping the rest bar jumps to the active exercise",
        "Logged sets' effort rating is now editable, and the daily-check card collapses during a session",
        "The Log tab folds by month, and the load-trend exercise picker in Stats is grouped by body part",
        "Exercise names imported from a personal pack now follow the app language, and a logo splash shows at launch",
      ],
      es: [
        "Corregidas las etiquetas desplazadas de la barra de descanso que mostraban 'Saltar' dos veces (-30s/+30s/Saltar restaurados)",
        "Registrar una serie de otro ejercicio ya no reinicia el temporizador de descanso en curso",
        "El ejercicio elegido se mantiene al visitar otras pestañas, y tocar la barra de descanso salta al ejercicio activo",
        "El esfuerzo de las series registradas ahora es editable, y la tarjeta de chequeo diario se pliega durante la sesión",
        "La pestaña Registro se pliega por mes, y el selector de ejercicios de la tendencia de carga se agrupa por parte del cuerpo",
        "Los nombres de ejercicios importados de un pack personal siguen el idioma de la app, y al abrir se muestra un splash con el logo",
      ],
      pt: [
        "Corrigidos os rótulos deslocados da barra de descanso que mostravam 'Pular' duas vezes (-30s/+30s/Pular restaurados)",
        "Registrar uma série de outro exercício não reinicia mais o cronômetro de descanso em andamento",
        "O exercício escolhido se mantém ao visitar outras abas, e tocar na barra de descanso leva ao exercício ativo",
        "O esforço das séries registradas agora é editável, e o cartão de checagem diária recolhe durante a sessão",
        "A aba Registro recolhe por mês, e o seletor de exercícios da tendência de carga é agrupado por parte do corpo",
        "Nomes de exercícios importados de um pack pessoal seguem o idioma do app, e uma splash com o logo aparece ao abrir",
      ],
      ja: [
        "休憩バーのボタンラベルがずれて「スキップ」が2つ表示される問題を修正（-30秒/+30秒/スキップを復元）",
        "休憩中に別の種目のセットを記録しても、進行中の休憩タイマーがリセットされなくなりました",
        "他のタブを見ても選択中の種目が維持され、休憩バーをタップすると進行中の種目へ移動します",
        "記録済みセットのきつさも修正でき、セッション中のデイリーチェックカードが折りたたみ式になりました",
        "記録タブが月ごとに折りたため、統計の重量推移の種目選択が部位別リストになりました",
        "個人パックから取り込んだ種目名もアプリの言語に追従し、起動時にロゴスプラッシュが表示されます",
      ],
      zh: [
        "修复休息栏按钮标签错位导致「跳过」显示两次的问题（恢复 -30秒/+30秒/跳过）",
        "休息期间记录其他动作的组数不再重置正在进行的休息计时",
        "切换到其他页后所选动作保持不变，点按休息栏可直接跳到进行中的动作",
        "已记录组的费力程度现在可以修改，训练中的每日检查卡片可折叠",
        "记录页按月折叠，统计中重量趋势的动作选择改为按部位分组",
        "从个人包导入的动作名称也会跟随应用语言，启动时显示徽标闪屏",
      ],
    },
  },
  {
    version: "1.7.0",
    date: "2026-08-14",
    notes: {
      ko: [
        "오늘 탭이 운동/신체 두 섹션으로 정리되고 모든 카드가 같은 접이식 카드로 통일되었습니다 (기본으로 펼칠 카드는 설정에서 선택, 물 카드는 접힌 상태에서도 섭취량 표시)",
        "웨이트 기록 카드에서 세션을 고르면 구성(운동, 세트x횟수, 목표중량)을 시작 전에 미리 볼 수 있습니다",
        "세션 편집의 목표중량이 lb/kg 두 칸으로 바뀌어 한쪽에 입력하면 다른 쪽이 자동 변환되고, 입력칸 줄이 한 줄로 정렬됩니다",
      ],
      en: [
        "The Today tab is grouped into Training and Body sections, with every card sharing the same collapsible style (pick the default expanded card in Settings; the water card shows your intake even while collapsed)",
        "Picking a session in the Weights log card now previews its composition (exercises, sets x reps, target load) before you start",
        "Target load in the session editor is now two boxes, lb and kg: typing in either fills the other, and the input row stays on one line",
      ],
      es: [
        "La pestaña Hoy se agrupa en secciones de Entrenamiento y Cuerpo, y todas las tarjetas comparten el mismo estilo plegable (elige en Ajustes la tarjeta expandida por defecto; la de agua muestra el consumo aun plegada)",
        "Al elegir una sesión en la tarjeta de pesas ahora se ve su composición (ejercicios, series x repeticiones, carga objetivo) antes de empezar",
        "La carga objetivo del editor de sesiones ahora son dos casillas, lb y kg: al escribir en una se rellena la otra, y la fila queda alineada",
      ],
      pt: [
        "A aba Hoje foi agrupada em seções de Treino e Corpo, e todos os cartões compartilham o mesmo estilo recolhível (escolha nas Configurações o cartão expandido por padrão; o de água mostra o consumo mesmo recolhido)",
        "Ao escolher uma sessão no cartão de musculação agora dá para ver a composição (exercícios, séries x repetições, carga alvo) antes de começar",
        "A carga alvo do editor de sessões agora são duas caixas, lb e kg: digitando em uma a outra é preenchida, e a linha fica alinhada",
      ],
      ja: [
        "「今日」タブがトレーニング/身体の2セクションに整理され、全カードが同じ折りたたみ式に統一されました（最初から開くカードは設定で選択、水分カードは閉じたままでも摂取量を表示）",
        "ウェイト記録カードでセッションを選ぶと、開始前に構成（種目、セットx回数、目標重量）を確認できます",
        "セッション編集の目標重量がlb/kgの2枠になり、片方に入力するともう片方が自動換算され、入力欄が一列に揃います",
      ],
      zh: [
        "今日页分为训练/身体两个分区，所有卡片统一为同样的折叠卡片（默认展开的卡片可在设置中选择，饮水卡片折叠时也显示饮水量）",
        "在力量训练记录卡片中选择训练后，开始前即可预览其构成（动作、组数x次数、目标重量）",
        "训练编辑中的目标重量改为 lb/kg 两个输入框，输入任一侧另一侧自动换算，输入行保持对齐",
      ],
    },
  },
  {
    version: "1.6.1",
    date: "2026-08-13",
    notes: {
      ko: [
        "처음 실행 화면에 '건너뛰기'가 생겨 코스 설정 없이 바로 메인 화면으로 이동할 수 있습니다 (추천 코스 생성은 설정에서 언제든 가능)",
        "첫 설정의 코스 미리보기 프로그램 이름이 앱 언어를 따라갑니다",
      ],
      en: [
        "A 'Skip' link on the first-run screen now takes you straight to the main screen without course setup (the course generator stays available in Settings)",
        "Program names in the first-run course preview now follow the app language",
      ],
      es: [
        "Un enlace 'Saltar' en la pantalla de primer uso te lleva directo a la pantalla principal sin configurar la rutina (el generador de rutinas sigue disponible en Ajustes)",
        "Los nombres de los programas en la vista previa inicial ahora siguen el idioma de la app",
      ],
      pt: [
        "Um link 'Pular' na tela de primeiro uso leva você direto à tela principal sem configurar o treino (o gerador de treinos continua disponível nas Configurações)",
        "Os nomes dos programas na prévia inicial agora seguem o idioma do app",
      ],
      ja: [
        "初回画面に「スキップ」が追加され、コース設定なしでメイン画面へ進めるようになりました（おすすめコース生成は設定からいつでも可能）",
        "初回設定のコースプレビューのプログラム名がアプリの言語に追従します",
      ],
      zh: [
        "首次启动页新增「跳过」，无需课程设置即可直接进入主界面（推荐课程生成仍可随时在设置中使用）",
        "首次设置的课程预览中的计划名称现在会跟随应用语言",
      ],
    },
  },
  {
    version: "1.6.0",
    date: "2026-08-12",
    notes: {
      ko: [
        "휴식 종료 알림이 실제로 도착합니다 (서버 키 문제 수정. 설정에서 알림 토글을 한 번 껐다 켜 주세요)",
        "운동명이 앱 언어를 따라갑니다 (직접 가져온 개인 팩의 운동은 그대로 유지)",
        "운동 목록과 선택창이 부위별로 정리되고, 팁 버튼이 '팁 보기'로 명확해졌습니다",
        "세션 중에도 기록한 세트를 탭해서 수정/삭제, 완료한 운동도 다시 열기, 휴식 -30초 버튼",
        "시작 화면 뒤로가기 버튼 중복과 설정에서 코스 생성 시 첫 화면으로 빠지던 문제 수정",
      ],
      en: [
        "Rest-end notifications now actually arrive (server key fixed; toggle notifications off and on once in Settings)",
        "Exercise names now follow the app language (your own imported pack exercises stay as you named them)",
        "Exercise lists and pickers are grouped by body part, and the tip button now reads 'Show tip'",
        "Tap a logged set to edit or delete it mid-session, reopen finished exercises, and a -30s rest button",
        "Fixed the duplicated back button on the start screen and the wizard backing out to the first-run screen",
      ],
      es: [
        "Los avisos de fin de descanso ahora llegan de verdad (clave del servidor corregida; apaga y enciende el aviso una vez en Ajustes)",
        "Los nombres de los ejercicios siguen el idioma de la app (los de tu pack personal se mantienen como los nombraste)",
        "Listas y selectores de ejercicios agrupados por parte del cuerpo, y el botón de consejo ahora dice 'Ver consejo'",
        "Toca una serie registrada para editarla o borrarla durante la sesión, reabre ejercicios terminados y botón de -30s de descanso",
        "Corregidos el botón de atrás duplicado en la pantalla inicial y el asistente que volvía a la pantalla de primer uso",
      ],
      pt: [
        "Os avisos de fim do descanso agora chegam de verdade (chave do servidor corrigida; desligue e ligue o aviso uma vez nas Configurações)",
        "Os nomes dos exercícios seguem o idioma do app (os do seu pack pessoal ficam como você os nomeou)",
        "Listas e seletores de exercícios agrupados por parte do corpo, e o botão de dica agora diz 'Ver dica'",
        "Toque numa série registrada para editar ou excluir durante a sessão, reabra exercícios concluídos e botão de -30s de descanso",
        "Corrigidos o botão de voltar duplicado na tela inicial e o assistente que voltava à tela de primeiro uso",
      ],
      ja: [
        "休憩終了の通知が実際に届くようになりました（サーバー鍵の問題を修正。設定で通知を一度オフ/オンしてください）",
        "種目名がアプリの言語に追従します（自分で取り込んだパックの種目は付けた名前のまま）",
        "種目リストと選択画面を部位別に整理し、コツのボタンが「コツを見る」に",
        "セッション中でも記録済みセットをタップして修正/削除、完了した種目の再オープン、休憩-30秒ボタン",
        "開始画面の戻るボタン重複と、設定からのコース生成で初回画面に戻る問題を修正",
      ],
      zh: [
        "休息结束通知现在真的会送达（修复了服务器密钥问题；请在设置中把通知开关关掉再打开一次）",
        "动作名称会跟随应用语言（你自己导入的个人包动作保持原名）",
        "动作列表和选择器按部位分组，要点按钮改为「查看要点」",
        "训练中可点按已记录的组进行修改/删除，可重新打开已完成的动作，新增休息-30秒按钮",
        "修复开始页返回按钮重复、以及从设置生成课程时退回首次启动页的问题",
      ],
    },
  },
  {
    version: "1.5.0",
    date: "2026-08-12",
    notes: {
      ko: [
        "운동 팁: 세션 중 진행 중인 운동 아래 '팁'을 누르면 자세 포인트 한 줄 (설정의 운동 라이브러리에서도 확인 가능)",
        "기본 운동 라이브러리가 46종으로 확장 (힙 쓰러스트, 레그프레스, 페이스풀, 해머컬 등). 기존 운동과 기록은 그대로 유지됩니다",
      ],
      en: [
        "Exercise tips: tap 'Tip' under the active exercise for a one-line form cue (also in the Settings exercise library)",
        "Default exercise library grown to 46 exercises (hip thrust, leg press, face pull, hammer curl, and more). Your existing exercises and history are untouched",
      ],
      es: [
        "Consejos de ejercicio: toca 'Consejo' bajo el ejercicio activo para una pauta de técnica de una línea (también en la biblioteca de ejercicios de Ajustes)",
        "La biblioteca de ejercicios crece a 46 (hip thrust, prensa de piernas, face pull, curl martillo y más). Tus ejercicios e historial no se tocan",
      ],
      pt: [
        "Dicas de exercício: toque em 'Dica' sob o exercício ativo para uma dica de execução de uma linha (também na biblioteca de exercícios das Configurações)",
        "A biblioteca padrão cresceu para 46 exercícios (hip thrust, leg press, face pull, rosca martelo e mais). Seus exercícios e histórico permanecem intactos",
      ],
      ja: [
        "種目のコツ: セッション中に実施中の種目の下の「コツ」をタップするとフォームの要点を1行表示（設定の種目ライブラリでも確認可能）",
        "デフォルトの種目ライブラリが46種目に拡大（ヒップスラスト、レッグプレス、フェイスプル、ハンマーカールなど）。既存の種目と記録はそのまま",
      ],
      zh: [
        "动作要点：训练中点按当前动作下方的「要点」即可查看一行技术提示（设置中的动作库也可查看）",
        "默认动作库扩充至46个（臀推、腿举、面拉、锤式弯举等）。你已有的动作和记录保持不变",
      ],
    },
  },
  {
    version: "1.4.0",
    date: "2026-08-12",
    notes: {
      ko: [
        "휴식 종료 알림: 휴식이 끝나는 순간 잠금화면으로 다음 세트 알림 (설정에서 켜기, 워치 미러링 지원)",
        "아이폰: 홈 화면에 설치한 앱에서 알림 권한을 허용하면 동작합니다",
      ],
      en: [
        "Rest-end notifications: a lock-screen alert with your next set the moment rest ends (enable in Settings; mirrors to your watch)",
        "iPhone: works in the home-screen app once notifications are allowed",
      ],
      es: [
        "Avisos de fin de descanso: una notificación en la pantalla de bloqueo con tu siguiente serie justo cuando termina el descanso (actívalo en Ajustes; también aparece en tu reloj)",
        "iPhone: funciona en la app instalada en la pantalla de inicio tras permitir las notificaciones",
      ],
      pt: [
        "Avisos de fim do descanso: uma notificação na tela de bloqueio com a sua próxima série no momento em que o descanso termina (ative nas Configurações; também aparece no seu relógio)",
        "iPhone: funciona no app instalado na tela de início após permitir as notificações",
      ],
      ja: [
        "休憩終了の通知: 休憩が終わった瞬間、次のセットをロック画面に通知（設定でオン、ウォッチにもミラーリング）",
        "iPhone: ホーム画面に追加したアプリで通知を許可すると動作します",
      ],
      zh: [
        "休息结束通知：休息结束的瞬间在锁屏上显示你的下一组（在设置中开启，也会同步到手表）",
        "iPhone: 在添加到主屏幕的应用中允许通知后即可使用",
      ],
    },
  },
  {
    version: "1.3.3",
    date: "2026-08-12",
    notes: {
      ko: [
        "업데이트 알림과 버전 내역이 6개 언어 모두로 제공",
        "시스템 언어가 지원되지 않는 경우 첫 언어 선택이 영어로 시작",
      ],
      en: [
        "Update notices and version history now come in all 6 languages",
        "First-run language starts as English when the system language is unsupported",
      ],
      es: [
        "Los avisos de actualización y el historial de versiones ahora están en los 6 idiomas",
        "El idioma inicial es inglés cuando el idioma del sistema no está disponible",
      ],
      pt: [
        "Avisos de atualização e histórico de versões agora em todos os 6 idiomas",
        "O idioma inicial é inglês quando o idioma do sistema não é suportado",
      ],
      ja: [
        "アップデート通知とバージョン履歴が6言語すべてに対応",
        "システム言語が非対応の場合、初回の言語選択が英語で開始",
      ],
      zh: [
        "更新通知和版本历史现已支持全部6种语言",
        "系统语言不受支持时，首次语言选择默认为英语",
      ],
    },
  },
  {
    version: "1.3.2",
    date: "2026-08-11",
    notes: {
      ko: [
        "입력할 때 화면이 저절로 확대되던 문제 해결 (두 손가락 확대는 그대로 사용 가능)",
        "버튼 연타 시 더블 탭 확대로 오인되던 문제 해결",
      ],
      en: [
        "Typing no longer auto-zooms the screen (pinch zoom still works)",
        "Fast button taps are no longer mistaken for double-tap zoom",
      ],
      es: [
        "Escribir ya no amplía la pantalla automáticamente (el zoom con dos dedos sigue funcionando)",
        "Los toques rápidos en botones ya no se confunden con el zoom de doble toque",
      ],
      pt: [
        "Digitar não amplia mais a tela automaticamente (o zoom de pinça continua funcionando)",
        "Toques rápidos nos botões não são mais confundidos com o zoom de toque duplo",
      ],
      ja: [
        "入力時に画面が勝手に拡大される問題を修正（ピンチ拡大はそのまま使用可能）",
        "ボタン連打がダブルタップ拡大と誤認される問題を修正",
      ],
      zh: [
        "修复输入时屏幕自动放大的问题（双指缩放仍可使用）",
        "修复快速连点按钮被误认为双击放大的问题",
      ],
    },
  },
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
      es: [
        "Editar sesiones completadas: cambia peso/repeticiones/esfuerzo por serie, añade o elimina series en el registro (cardio incluido)",
        "Restaura con un código de sincronización desde la pantalla de primer uso",
        "La importación de archivos del primer uso acepta archivos .ttpack",
      ],
      pt: [
        "Editar sessões concluídas: mude peso/repetições/esforço por série, adicione ou exclua séries no registro (cardio incluído)",
        "Restaure com um código de sincronização direto da tela de primeiro uso",
        "A importação de arquivos do primeiro uso aceita arquivos .ttpack",
      ],
      ja: [
        "完了したセッションの編集: 記録画面でセットの重量・回数・体感を変更、セットの追加・削除（有酸素も対応）",
        "初回画面から同期コードで復元可能",
        "初回のファイル取り込みが .ttpack ファイルに対応",
      ],
      zh: [
        "编辑已完成的训练：在记录中修改每组的重量/次数/感受，添加或删除组（有氧也支持）",
        "可在首次使用界面直接用同步代码恢复",
        "首次使用的文件导入支持 .ttpack 文件",
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
      es: [
        "Copia de seguridad en la nube: copia y restaura entre dispositivos con un solo código (cifrada en tu dispositivo; el servidor no puede leerla)",
        "Enviar comentarios: informa errores y sugiere mejoras desde Ajustes",
        "La copia en archivo ahora usa el formato .ttpack y admite la hoja de compartir de iOS",
        "Banner de instalación en la pantalla de inicio",
        "Avisos de actualización y pantalla de historial de versiones",
      ],
      pt: [
        "Backup na nuvem: faça backup e restaure entre aparelhos com um só código (criptografado no seu aparelho; o servidor não consegue ler)",
        "Enviar feedback: relate bugs e sugira melhorias direto das Configurações",
        "O backup em arquivo agora usa o formato .ttpack e suporta a folha de compartilhamento do iOS",
        "Banner de instalação na tela inicial",
        "Avisos de atualização e tela de histórico de versões",
      ],
      ja: [
        "クラウドバックアップ: コード1つで端末間のバックアップと復元（端末上で暗号化され、サーバーは内容を読めません）",
        "フィードバック送信: 設定からバグ報告や提案を開発者に直接送信",
        "ファイルバックアップが .ttpack 形式になり、iPhoneの共有シートで保存可能",
        "ホーム画面インストール案内バナーを追加",
        "アップデート通知とバージョン履歴画面を追加",
      ],
      zh: [
        "云备份：用一个代码在设备之间备份和恢复（在设备上加密，服务器无法读取内容）",
        "发送反馈：在设置中直接向开发者报告错误和提出建议",
        "文件备份改为 .ttpack 格式，支持 iOS 分享菜单保存",
        "新增主屏幕安装提示横幅",
        "新增更新通知和版本历史界面",
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
      es: [
        "Estilos de calentamiento: rampa (50→70%) o fijo",
        "Descanso predeterminado por tipo de ejercicio (compuesto 150s / aislamiento 90s) y descanso entre ejercicios",
        "Elige ejercicios en cualquier orden en la pantalla Hoy",
        "Indicaciones del criterio de carga (barra excluida / por mano / placa) y notas de sesión",
        "Corregido: las cargas de calentamiento se mezclaban con las series efectivas",
      ],
      pt: [
        "Estilos de aquecimento: rampa (50→70%) ou fixo",
        "Descanso padrão por tipo de exercício (composto 150s / isolado 90s) e descanso entre exercícios",
        "Escolha exercícios em qualquer ordem na tela Hoje",
        "Dicas de convenção de carga (barra excluída / por mão / placa) e notas de sessão",
        "Corrigido: cargas de aquecimento vazavam para as séries válidas",
      ],
      ja: [
        "ウォームアップ方式の選択: ランプ（50→70%）または固定",
        "種目タイプ別の休憩デフォルト（コンパウンド150秒／アイソレーション90秒）と種目間の休憩",
        "今日画面で順番に関係なく種目を選択可能",
        "重量表記の基準案内（バー除く／片手あたり／スタック）とセッションメモ",
        "ウォームアップの重量が本セットに混ざるバグを修正",
      ],
      zh: [
        "热身方式可选：递增（50→70%）或固定",
        "按动作类型的默认休息时间（复合150秒/孤立90秒）以及动作之间的休息",
        "在今天页面可不按顺序选择动作",
        "负重标注说明（不含杠铃杆/单手/配重片）和训练备注",
        "修复热身重量混入正式组的问题",
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
      es: [
        "Añadidos japonés y chino (6 idiomas en total)",
        "Paso de selección de idioma en el primer uso",
        "Duración estimada en el selector de programas",
        "Resumen del chequeo diario y notas en el detalle del registro",
      ],
      pt: [
        "Adicionados japonês e chinês (6 idiomas no total)",
        "Etapa de escolha de idioma no primeiro uso",
        "Tempo estimado da sessão no seletor de programas",
        "Resumo do check diário e notas no detalhe do registro",
      ],
      ja: [
        "日本語と中国語を追加（全6言語）",
        "初回起動時に言語選択ステップを追加",
        "プログラム選択画面に推定所要時間を表示",
        "記録詳細にデイリーチェックの要約とメモを表示",
      ],
      zh: [
        "新增日语和中文（共6种语言）",
        "首次使用时增加语言选择步骤",
        "程序选择界面显示预计时长",
        "记录详情中显示每日检查摘要和备注",
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
      es: [
        "Marca de series no realizadas en el detalle del registro",
        "Corregida la eliminación de sesiones de cardio",
        "Registro de tiempo de aguante (segundos) para calistenia",
        "Zonas de dolor más detalladas y eliminación más segura en la biblioteca",
      ],
      pt: [
        "Marcação de séries não realizadas no detalhe do registro",
        "Corrigida a exclusão de sessões de cardio",
        "Registro de tempo de sustentação (segundos) para calistenia",
        "Áreas de dor mais detalhadas e exclusão mais segura na biblioteca",
      ],
      ja: [
        "記録詳細に未実施の表示を追加",
        "有酸素セッションの削除を修正",
        "自重トレの保持時間（秒）記録に対応",
        "痛み部位の細分化とライブラリ削除の安全対策",
      ],
      zh: [
        "记录详情中标记未完成的组",
        "修复有氧训练删除问题",
        "支持记录自重训练的保持时间（秒）",
        "疼痛部位更细化，动作库删除更安全",
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
      es: [
        "Temporizador de descanso entre series",
        "Unidades de visualización (kg/lb) con unidad separada para el peso corporal",
        "Registro de cardio (RPE, frecuencia cardíaca, ritmo), agua, proteína y composición corporal",
        "Métodos de entrenamiento (pirámide, superserie, serie descendente)",
        "Generador de rutinas, guía de primer uso y perfiles de invitado",
        "Añadidos inglés, español y portugués",
      ],
      pt: [
        "Cronômetro de descanso entre séries",
        "Unidades de exibição (kg/lb) com unidade separada para o peso corporal",
        "Registro de cardio (RPE, frequência cardíaca, ritmo), água, proteína e composição corporal",
        "Métodos de treino (pirâmide, superserie, drop set)",
        "Gerador de rotinas, guia de primeiro uso e perfis de convidado",
        "Adicionados inglês, espanhol e português",
      ],
      ja: [
        "セット間の休憩タイマー",
        "表示単位の選択（kg/lb）と体重単位の分離",
        "有酸素記録（RPE・心拍・ペース）、水分・タンパク質・体組成の記録",
        "トレーニング法（ピラミッド・スーパーセット・ドロップセット）に対応",
        "ルーチン生成と初回ガイド、ゲストプロフィール",
        "英語・スペイン語・ポルトガル語を追加",
      ],
      zh: [
        "组间休息倒计时",
        "显示单位可选（kg/lb），体重单位独立设置",
        "有氧记录（RPE、心率、配速），水分、蛋白质和身体成分追踪",
        "训练法（金字塔、超级组、递减组）支持",
        "训练计划生成器、首次使用引导、访客档案",
        "新增英语、西班牙语和葡萄牙语",
      ],
    },
  },
  {
    version: "1.0.0",
    date: "2026-08-04",
    notes: {
      ko: ["첫 공개: 프로그램 기반 웨이트 기록, 무게 인벤토리, 진행 제안, 통계"],
      en: ["First release: program-based lifting log, weight inventory, progression suggestions, stats"],
      es: ["Primera versión: registro de pesas basado en programas, inventario de pesos, sugerencias de progresión y estadísticas"],
      pt: ["Primeira versão: registro de treinos baseado em programas, inventário de pesos, sugestões de progressão e estatísticas"],
      ja: ["初回リリース: プログラムベースの筋トレ記録、重量インベントリ、漸進の提案、統計"],
      zh: ["首次发布：基于计划的力量训练记录、重量库存、渐进建议、统计"],
    },
  },
];
