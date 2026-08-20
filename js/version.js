// Single source of truth for the app version and user-facing patch notes.
// Notes ship in all six UI languages (ko en es pt ja zh); the update notice
// and the settings version history pick the active language and fall back to
// English. The i18n parity test asserts every entry covers every language.
// Newest entry first. The service worker cache version is bumped separately
// in sw.js at each deploy.

export const APP_VERSION = "1.14.1";

export const CHANGELOG = [
  {
    version: "1.14.1",
    date: "2026-08-19",
    notes: {
      ko: [
        "세션 무게가 실제 기록을 따라갑니다: 지난 세션에서 실제로 든 무게가 다음 세션의 기본 무게, 증량 안내, 세션 미리보기에 그대로 반영됩니다 (기존에는 전 세트를 '여유'로 평가했을 때만 목표 무게가 올라가서, 직접 올린 무게가 다음 세션에 반영되지 않았습니다)",
        "무게 +/- 버튼이 잘못 저장된 기구별 최대 무게에 막히지 않습니다: 현재 무게가 설정된 최대치보다 높으면 그 최대치를 무시하고 기구별 증분으로 계속 오르내립니다 (예: 75 lb에서 +가 안 눌리고 -가 15 lb로 떨어지던 문제). 정확히 최대치에서 +를 누르면 안내가 표시됩니다",
        "글자를 입력하는 동안 하단 탭바가 키보드 위로 딸려 올라오지 않습니다 (입력 중에는 숨겨지고 끝나면 복귀)",
        "버튼 밖 빈 곳을 빠르게 두 번 탭해도 화면이 확대되지 않습니다 (두 손가락 확대는 그대로 사용 가능)",
      ],
      en: [
        "Session weights now follow your actual records: the weight you really lifted last session becomes the next session's default, progression hint, and preview (before, the target only rose when every set was rated easy, so manually raised weights never carried over)",
        "The weight +/- stepper no longer dead-ends on a bad per-machine max: when the current weight sits above the configured cap, stepping continues by the equipment's increment (e.g. stuck at 75 lb with - crashing to 15 lb). Pressing + exactly at the cap shows a notice",
        "The bottom tab bar no longer rides up on top of the keyboard while typing (hidden during input, restored after)",
        "Fast double-taps on empty areas no longer zoom the screen (pinch zoom still works)",
      ],
      es: [
        "Los pesos de sesión siguen tus registros reales: el peso que realmente levantaste la última sesión pasa a ser el predeterminado, la sugerencia de progresión y la vista previa (antes el objetivo solo subía si todas las series se calificaban fáciles)",
        "El botón +/- de peso ya no se bloquea por un máximo por máquina mal guardado: si el peso actual supera el tope configurado, sigue subiendo por el incremento del equipo (p. ej., atascado en 75 lb y el - caía a 15 lb). Al pulsar + justo en el tope se muestra un aviso",
        "La barra de pestañas inferior ya no sube sobre el teclado al escribir (se oculta durante la entrada y vuelve después)",
        "Los dobles toques rápidos en zonas vacías ya no amplían la pantalla (el zoom con dos dedos sigue funcionando)",
      ],
      pt: [
        "Os pesos da sessão seguem seus registros reais: o peso que você realmente levantou na última sessão vira o padrão, a sugestão de progressão e a prévia da próxima (antes a meta só subia quando todas as séries eram avaliadas como fáceis)",
        "O botão +/- de peso não trava mais em um máximo por máquina salvo errado: se o peso atual está acima do teto configurado, continua subindo pelo incremento do equipamento (ex.: preso em 75 lb com o - caindo para 15 lb). Apertar + exatamente no teto mostra um aviso",
        "A barra de abas inferior não sobe mais junto com o teclado ao digitar (fica oculta durante a digitação e volta depois)",
        "Toques duplos rápidos em áreas vazias não ampliam mais a tela (o zoom de pinça continua funcionando)",
      ],
      ja: [
        "セッションの重量が実際の記録に追従します: 前回実際に挙げた重量が次のセッションの初期値・増量案内・プレビューに反映されます（従来は全セットを「余裕」と評価したときだけ目標重量が上がる仕様でした）",
        "重量の+/-ボタンが誤って保存された器具別最大値で止まらなくなりました: 現在の重量が設定上限を超えている場合は器具ごとの増分で上下し続けます（例: 75 lbで+が効かず-で15 lbに落ちる問題）。ちょうど上限で+を押すと案内が表示されます",
        "入力中に下部タブバーがキーボードの上に乗り上がらなくなりました（入力中は非表示、終了後に復帰）",
        "ボタン以外の空き領域を素早く2回タップしても画面が拡大されません（ピンチ拡大はそのまま使えます）",
      ],
      zh: [
        "训练重量现在跟随实际记录: 上次训练实际举起的重量会成为下次的默认重量、加重建议和预览（此前只有所有组都评为轻松时目标重量才会上升，手动加的重量不会带入下次）",
        "重量+/-按钮不再被错误保存的器械最大值卡住: 当前重量高于设置上限时，会按器械增量继续加减（例如卡在75磅、按-直接跌到15磅的问题）。恰好在上限按+会显示提示",
        "输入文字时底部标签栏不再随键盘顶起（输入期间隐藏，结束后恢复）",
        "快速双击空白区域不再放大页面（双指缩放仍然可用）",
      ],
    },
  },
  {
    version: "1.14.0",
    date: "2026-08-19",
    notes: {
      ko: [
        "세션 탭: 세션 칩을 꾹 눌러 좌우로 끌면 순서가 바뀝니다 (아이폰 홈 화면 방식). 가로 스크롤바가 아래 내용과 겹치던 문제도 수정",
        "카드 이름 정리: 웨이트 기록 > 웨이트 세션, 스킬 목표 > 맨몸 스킬 세션 추가 (설명 추가)",
        "물 섭취: 칸을 누르면 그 칸까지 바로 채워지고, 양옆 화살표로 한 컵씩 조절합니다",
        "기록 탭: 주차가 그 달의 첫 월요일 기준으로 계산됩니다 (8월 17일 = 3주차). 전월에 속한 주는 전월 주차로 표시",
        "기록 탭: 전체 보기에서 체중이 카드 대신 주차 라벨 옆에 요약됩니다 (73 > 72.3 kg). 체중 필터에서는 기존처럼 카드로 표시",
        "기록 상세가 요약 행을 다시 누르면 접힙니다 (기존에는 상세 안쪽을 눌러도 접혀서 편집 중에 닫히곤 했습니다)",
        "식단 카드에 단백질 섭취량(g) 입력이 생겼고, 체중 카드에 최근 기록이 표시됩니다",
        "설정 > 기본으로 펼칠 카드 목록에 수면과 식단이 추가되었습니다",
      ],
      en: [
        "Session tab: press-hold a session chip and drag sideways to reorder (iPhone home-screen style). The horizontal scrollbar no longer overlaps content below",
        "Card names cleaned up: Weights log > Weights session, Skill goals > Add a skill session (with a description)",
        "Water: tapping a cup fills straight to it, and side arrows adjust one cup at a time",
        "Log tab: weeks are numbered from the month's first Monday (Aug 17 = week 3); a spillover week is labeled by the previous month",
        "Log tab: in the all view, bodyweight folds into the week label (73 > 72.3 kg) instead of separate cards; the bodyweight filter still shows cards",
        "Session detail collapses by tapping the summary row again (taps inside the open detail used to collapse it mid-edit)",
        "The Diet card gained a protein-eaten (g) input, and the Bodyweight card shows the latest record",
        "Settings > default expanded card now lists Sleep and Diet too",
      ],
      es: [
        "Pestaña Sesión: mantén pulsado un chip de sesión y arrástralo para reordenar (estilo pantalla de inicio de iPhone). La barra de desplazamiento ya no tapa el contenido inferior",
        "Nombres de tarjetas: Registro de pesas > Sesión de pesas, Metas de habilidad > Añadir sesión de habilidad (con descripción)",
        "Agua: tocar un vaso llena hasta ese vaso, y las flechas laterales ajustan de a un vaso",
        "Registro: las semanas se numeran desde el primer lunes del mes (17 ago = semana 3); una semana de arrastre se etiqueta con el mes anterior",
        "Registro: en la vista general, el peso corporal se resume junto a la etiqueta de semana (73 > 72.3 kg) en lugar de tarjetas; el filtro de peso las mantiene",
        "El detalle de sesión se pliega tocando de nuevo la fila de resumen (antes se plegaba al tocar dentro del detalle durante la edición)",
        "La tarjeta Dieta ganó un campo de proteína consumida (g), y la de Peso muestra el último registro",
        "Ajustes > tarjeta expandida por defecto ahora incluye Sueño y Dieta",
      ],
      pt: [
        "Aba Sessão: pressione e segure um chip de sessão e arraste para reordenar (estilo tela inicial do iPhone). A barra de rolagem não cobre mais o conteúdo abaixo",
        "Nomes de cartões: Registro de musculação > Sessão de musculação, Metas de habilidade > Adicionar sessão de habilidade (com descrição)",
        "Água: tocar um copo preenche até ele, e as setas laterais ajustam um copo por vez",
        "Registro: as semanas são numeradas a partir da primeira segunda-feira do mês (17 ago = semana 3); uma semana de transição é rotulada pelo mês anterior",
        "Registro: na visão geral, o peso corporal aparece resumido junto ao rótulo da semana (73 > 72.3 kg) em vez de cartões; o filtro de peso os mantém",
        "O detalhe da sessão recolhe tocando de novo na linha de resumo (antes recolhia ao tocar dentro do detalhe durante a edição)",
        "O cartão Dieta ganhou um campo de proteína consumida (g), e o de Peso mostra o último registro",
        "Configurações > cartão expandido padrão agora inclui Sono e Dieta",
      ],
      ja: [
        "セッションタブ: セッションチップを長押しして左右にドラッグすると順序を変更できます（iPhoneホーム画面方式）。横スクロールバーが下の内容と重なる問題も修正",
        "カード名を整理: ウェイト記録 > ウェイトセッション、スキル目標 > 自重スキルセッション追加（説明付き）",
        "水分: コップをタップするとそこまで一気に入り、左右の矢印で1杯ずつ調整できます",
        "記録タブ: 週番号がその月の最初の月曜日基準になりました（8月17日 = 第3週）。前月にまたがる週は前月の週として表示",
        "記録タブ: 全体表示では体重がカードではなく週ラベルに要約されます（73 > 72.3 kg）。体重フィルターでは従来どおりカード表示",
        "記録の詳細は要約行をもう一度タップすると閉じます（従来は詳細の内側をタップしても閉じて、編集中に閉じることがありました）",
        "食事カードにタンパク質摂取量(g)の入力が加わり、体重カードに直近の記録が表示されます",
        "設定 > 既定で開くカードに睡眠と食事が追加されました",
      ],
      zh: [
        "训练页：长按训练芯片并左右拖动即可调整顺序（iPhone主屏幕方式）。横向滚动条不再遮挡下方内容",
        "卡片名称整理：力量训练记录 > 力量训练，技能目标 > 添加技能训练（附说明）",
        "饮水：点击某格会直接填到该格，两侧箭头可逐杯调整",
        "记录页：周序号改为按当月第一个周一计算（8月17日 = 第3周）；跨月周按上月标注",
        "记录页：在全部视图中，体重以摘要形式显示在周标签旁（73 > 72.3 kg）而非单独卡片；体重筛选下仍显示卡片",
        "训练详情改为再次点击摘要行即可收起（此前点击详情内部也会收起，编辑中容易误关）",
        "饮食卡片新增蛋白质摄入量(g)输入，体重卡片会显示最近记录",
        "设置 > 默认展开的卡片新增睡眠和饮食",
      ],
    },
  },
  {
    version: "1.13.2",
    date: "2026-08-19",
    notes: {
      ko: [
        "전날 종료하지 않은 세션이 오늘 날짜로 계속 진행 중처럼 보이던 문제: 이제 세션 탭이 종료 안내를 먼저 보여줍니다 (세트 기록은 그대로 보존, 시간은 미기록 처리; 이어서 진행도 가능)",
        "오래 전에 끝난 휴식 타이머가 0:00 상태로 계속 떠 있던 문제를 수정했습니다",
        "하단 휴식 바가 화면 레이아웃이 안정되기 전에 위치를 잡아 잘려 보일 수 있던 문제: 표시할 때마다 위치를 다시 계산합니다",
      ],
      en: [
        "A session left un-ended on a previous day no longer shows as running under today's date: the Session tab now offers to close it first (all logged sets kept, duration marked unrecorded; resuming is still possible)",
        "Fixed a rest timer that ended long ago staying on screen at 0:00",
        "The bottom rest bar could be clipped when positioned before layout settled; it now re-measures its position on every update",
      ],
      es: [
        "Una sesión sin finalizar de un día anterior ya no aparece como activa con la fecha de hoy: la pestaña Sesión ofrece cerrarla primero (todas las series se conservan, duración sin registrar; también se puede continuar)",
        "Corregido un temporizador de descanso terminado hace tiempo que seguía en pantalla en 0:00",
        "La barra de descanso inferior podía verse cortada al posicionarse antes de asentarse el diseño; ahora recalcula su posición en cada actualización",
      ],
      pt: [
        "Uma sessão não finalizada de um dia anterior não aparece mais como ativa com a data de hoje: a aba Sessão oferece fechá-la primeiro (todas as séries mantidas, duração não registrada; continuar também é possível)",
        "Corrigido um cronômetro de descanso encerrado há muito tempo que permanecia na tela em 0:00",
        "A barra de descanso inferior podia ficar cortada ao se posicionar antes de o layout assentar; agora recalcula a posição a cada atualização",
      ],
      ja: [
        "前日に終了しなかったセッションが今日の日付で進行中のように見え続ける問題: セッションタブが先に終了案内を表示します（記録済みセットは保持、時間は未記録扱い。続行も可能）",
        "とっくに終わった休憩タイマーが0:00のまま表示され続ける問題を修正しました",
        "下部の休憩バーがレイアウト確定前に位置を決めて欠けて見えることがある問題: 表示のたびに位置を再計算します",
      ],
      zh: [
        "前一天未结束的训练不再以今天的日期显示为进行中：训练页会先提示结束（已记录的组全部保留，时长按未记录处理；也可以继续进行）",
        "修复了早已结束的休息计时器一直停留在0:00的问题",
        "底部休息条可能在布局稳定前定位导致显示被裁切：现在每次更新都会重新计算位置",
      ],
    },
  },
  {
    version: "1.13.1",
    date: "2026-08-19",
    notes: {
      ko: [
        "기록 탭 주차 구분이 월요일-일요일 달력 주 기준으로 바뀌었습니다 (통계 탭의 주간 집계와 동일한 기준, 그 달 1일이 포함된 주가 1주차)",
      ],
      en: [
        "Week grouping in the Log tab now follows Monday-Sunday calendar weeks (the same convention as the Stats tab's weekly totals; week 1 is the week containing the 1st of the month)",
      ],
      es: [
        "La agrupación por semanas en Registro ahora sigue semanas de calendario de lunes a domingo (el mismo criterio que los totales semanales de Estadísticas; la semana 1 es la que contiene el día 1 del mes)",
      ],
      pt: [
        "O agrupamento por semanas no Registro agora segue semanas de calendário de segunda a domingo (o mesmo critério dos totais semanais de Estatísticas; a semana 1 é a que contém o dia 1 do mês)",
      ],
      ja: [
        "記録タブの週分けが月曜-日曜のカレンダー週基準になりました（統計タブの週間集計と同じ基準、その月の1日を含む週が第1週）",
      ],
      zh: [
        "记录页的按周分组改为周一至周日的日历周（与统计页的每周汇总一致；包含当月1日的那一周为第1周）",
      ],
    },
  },
  {
    version: "1.13.0",
    date: "2026-08-19",
    notes: {
      ko: [
        "설정 > 보유 무게 > 기구별 예외: 추가한 무게 기준을 목록에서 바로 수정할 수 있고, 같은 이름의 운동(변형 포함)에는 하나의 기준이 함께 적용됩니다",
        "설정 > 보유 무게 > 덤벨: 잘못 추가한 무게를 목록에서 삭제할 수 있습니다",
        "설정 > 프로그램 > 리커버리 규칙에서 리커버리 모드를 직접 켜고 끌 수 있습니다 (기존에는 14일 공백 배너로만 켤 수 있었습니다)",
        "기록 탭: 월 그룹 안에서 주차별(1주차, 2주차...)로 나뉘어 표시됩니다",
        "기록 상세에 단백질 목표 확인 여부가 표시됩니다",
        "세션 중 세트 편집기에 체감 라벨이 붙어 힘듦/보통/여유 수정임을 알아보기 쉽습니다",
        "설정 > 데이터 > 세션 공유: 파일 없이 짧은 코드로도 세션 구성을 주고받을 수 있습니다 (백업 코드와 별개, 암호화 저장 180일)",
        "탭 개편: 유산소와 맨몸운동 기록이 세션 탭으로 이동하고, 오늘 탭은 물, 체중, 수면, 식단 등 신체 기록 전용이 되었습니다",
        "오늘 탭에 수면 카드와 식단 카드가 생겼습니다: 단백질 목표와 확인 체크, 일반 식품 단백질 함량 참고표. 수면과 단백질 확인은 세션 시작 시 컨디션 체크에 자동 반영됩니다",
      ],
      en: [
        "Settings > Inventory > Per-exercise exceptions: added weight caps are editable in place, and one cap applies to every exercise with the same name (variants included)",
        "Settings > Inventory > Dumbbells: a mistyped weight can now be removed from the list",
        "Recovery mode can be switched on and off directly in Settings > Program > Recovery rule (previously only reachable through the 14-day gap banner)",
        "Log tab: entries inside each month are now grouped by week (Week 1, Week 2...)",
        "Session detail in the log now shows whether the protein target was checked",
        "The in-session set editor labels its effort row so the hard/normal/easy chips read as editable",
        "Settings > Data > Share sessions: session setups can now also be traded with a short code, no file needed (separate from the backup code, encrypted storage for 180 days)",
        "Tab rework: cardio and calisthenics logging moved to the Session tab; the Today tab is now body records only (water, bodyweight, sleep, diet)",
        "New Sleep and Diet cards on Today: protein target with a daily check plus a protein reference for common foods. Sleep and the protein check flow into the session's daily check automatically",
      ],
      es: [
        "Ajustes > Inventario > Excepciones por ejercicio: los topes de peso se editan en el lugar y un tope se aplica a todos los ejercicios con el mismo nombre (variantes incluidas)",
        "Ajustes > Inventario > Mancuernas: un peso mal escrito ahora puede quitarse de la lista",
        "El modo recuperación puede activarse y desactivarse directamente en Ajustes > Programa > Regla de recuperación (antes solo mediante el aviso de 14 días)",
        "Pestaña Registro: las entradas de cada mes se agrupan por semana (Semana 1, Semana 2...)",
        "El detalle de sesión en el registro muestra si se confirmó la meta de proteína",
        "El editor de series dentro de la sesión etiqueta su fila de esfuerzo para que se reconozca como editable",
        "Ajustes > Datos > Compartir sesiones: las configuraciones también se intercambian con un código corto, sin archivo (separado del código de respaldo, almacenamiento cifrado por 180 días)",
        "Reorganización de pestañas: el registro de cardio y calistenia pasó a la pestaña Sesión; la pestaña Hoy es solo para registros corporales (agua, peso, sueño, dieta)",
        "Nuevas tarjetas de Sueño y Dieta en Hoy: meta de proteína con verificación diaria y referencia de proteína de alimentos comunes. El sueño y la verificación pasan automáticamente al chequeo diario de la sesión",
      ],
      pt: [
        "Configurações > Inventário > Exceções por exercício: os limites de peso são editáveis no lugar e um limite se aplica a todos os exercícios com o mesmo nome (variantes incluídas)",
        "Configurações > Inventário > Halteres: um peso digitado errado agora pode ser removido da lista",
        "O modo recuperação pode ser ligado e desligado diretamente em Configurações > Programa > Regra de recuperação (antes só pelo aviso de 14 dias)",
        "Aba Registro: as entradas de cada mês agora são agrupadas por semana (Semana 1, Semana 2...)",
        "O detalhe da sessão no registro mostra se a meta de proteína foi conferida",
        "O editor de séries na sessão rotula sua linha de esforço para que fique claro que é editável",
        "Configurações > Dados > Compartilhar sessões: as configurações também podem ser trocadas com um código curto, sem arquivo (separado do código de backup, armazenamento criptografado por 180 dias)",
        "Reorganização das abas: o registro de cardio e calistenia foi para a aba Sessão; a aba Hoje agora é só para registros corporais (água, peso, sono, dieta)",
        "Novos cartões de Sono e Dieta em Hoje: meta de proteína com verificação diária e referência de proteína de alimentos comuns. O sono e a verificação entram automaticamente no check diário da sessão",
      ],
      ja: [
        "設定 > 保有重量 > 種目別の例外: 追加した重量上限をその場で修正でき、同じ名前の種目（バリエーション含む）には一つの上限がまとめて適用されます",
        "設定 > 保有重量 > ダンベル: 誤って追加した重量をリストから削除できます",
        "設定 > プログラム > リカバリールールでリカバリーモードを直接オン/オフできます（従来は14日空白バナーからのみ）",
        "記録タブ: 月グループ内が週ごと（第1週、第2週...）に分かれて表示されます",
        "記録の詳細にタンパク質目標の確認有無が表示されます",
        "セッション中のセット編集に体感ラベルが付き、修正できることが分かりやすくなりました",
        "設定 > データ > セッション共有: ファイルなしでも短いコードでセッション構成を交換できます（バックアップコードとは別、暗号化保存180日）",
        "タブ再編: 有酸素と自重トレの記録がセッションタブに移動し、今日タブは水分・体重・睡眠・食事など体の記録専用になりました",
        "今日タブに睡眠カードと食事カードを追加: タンパク質目標と確認チェック、一般的な食品のタンパク質目安表。睡眠と確認はセッション開始時にコンディションチェックへ自動反映されます",
      ],
      zh: [
        "设置 > 现有重量 > 按动作例外：添加的重量上限可直接修改，同名动作（含变式）共用同一上限",
        "设置 > 现有重量 > 哑铃：输错的重量现在可以从列表中移除",
        "恢复模式可在设置 > 计划 > 恢复规则中直接开关（此前只能通过14天空档提示开启）",
        "记录页：每月内的条目现在按周分组（第1周、第2周...）",
        "记录详情会显示是否确认了蛋白质目标",
        "训练中的组数编辑器为感受一行加上了标签，更容易看出可以修改",
        "设置 > 数据 > 分享训练：无需文件，也能用短代码交换训练配置（与备份代码相互独立，加密保存180天）",
        "页签调整：有氧和自重训练记录移至训练页；今天页现在只保留身体记录（饮水、体重、睡眠、饮食）",
        "今天页新增睡眠卡片和饮食卡片：蛋白质目标与每日确认，以及常见食品蛋白质参考表。睡眠和确认会在开始训练时自动带入状态检查",
      ],
    },
  },
  {
    version: "1.12.0",
    date: "2026-08-15",
    notes: {
      ko: [
        "세션 탭에 스킬 목표 카드: 머슬업, 플란체, 프론트 레버, 핸드스탠드, L싯의 입문/중급 커리큘럼을 검증된 진행 기준(3x8 또는 홀드 15초 이상 시 다음 단계)으로 제공합니다",
        "설정 > 데이터 > 세션 공유: 선택한 세션 구성만 파일로 내보내 친구와 교환할 수 있습니다 (운동 기록 등 개인 데이터 제외)",
        "설정 > 세션 편집에서 세션 순서를 화살표로 변경할 수 있고, 세션 선택에도 그대로 반영됩니다",
        "홀드 성격 운동(플란치 린, L싯, 플랭크 등)은 세트 입력이 자동으로 시간 모드로 열립니다",
      ],
      en: [
        "Skill goals card on the Session tab: beginner/intermediate curricula for muscle-up, planche, front lever, handstand, and L-sit, with evidence-based advancement standards (3x8 or 15s+ holds)",
        "Settings > Data > Share sessions: export only chosen session setups as a file to trade with friends (no personal history included)",
        "Sessions can be reordered with arrows in Settings > Session editor, reflected in the session picker",
        "Hold-type movements (planche lean, L-sit, plank and friends) open the set entry in time mode automatically",
      ],
      es: [
        "Tarjeta de metas de habilidad en la pestaña Sesión: currículos inicial/intermedio para muscle-up, planche, front lever, pino y L-sit, con estándares de progresión con base en evidencia (3x8 o holds de 15s+)",
        "Ajustes > Datos > Compartir sesiones: exporta solo las sesiones elegidas como archivo para intercambiar con amigos (sin historial personal)",
        "Las sesiones se pueden reordenar con flechas en Ajustes > Editor de sesiones, reflejado en el selector",
        "Los movimientos de sostén (planche lean, L-sit, plancha y similares) abren la entrada de series en modo tiempo automáticamente",
      ],
      pt: [
        "Cartão de metas de habilidade na aba Sessão: currículos iniciante/intermediário para muscle-up, planche, front lever, parada de mão e L-sit, com padrões de progressão baseados em evidência (3x8 ou holds de 15s+)",
        "Configurações > Dados > Compartilhar sessões: exporte só as sessões escolhidas como arquivo para trocar com amigos (sem histórico pessoal)",
        "As sessões podem ser reordenadas com setas em Configurações > Editor de sessões, refletido no seletor",
        "Movimentos de sustentação (planche lean, L-sit, prancha e afins) abrem a entrada de séries no modo tempo automaticamente",
      ],
      ja: [
        "セッションタブにスキル目標カード: マッスルアップ・プランシェ・フロントレバー・倒立・Lシットの入門/中級カリキュラムを、根拠ある進行基準（3x8またはホールド15秒以上で次段階）で提供します",
        "設定 > データ > セッション共有: 選んだセッション構成だけをファイルで書き出して友人と交換できます（個人記録は含まれません）",
        "設定 > セッション編集で矢印によりセッションの順序を変更でき、セッション選択にも反映されます",
        "ホールド系種目（プランシェリーン、Lシット、プランクなど）はセット入力が自動で時間モードになります",
      ],
      zh: [
        "训练页新增技能目标卡片：双力臂、俄挺、前水平、倒立、L支撑的入门/中级课程，采用有依据的进阶标准（3x8或保持15秒以上进入下一阶段）",
        "设置 > 数据 > 分享训练：仅导出所选训练配置为文件与朋友交换（不含个人记录）",
        "设置 > 训练编辑中可用箭头调整训练顺序，并同步反映在训练选择中",
        "保持类动作（俄挺前倾、L支撑、平板支撑等）的组数输入会自动以时间模式打开",
      ],
    },
  },
  {
    version: "1.11.0",
    date: "2026-08-15",
    notes: {
      ko: [
        "세션 진행 중에도 홀드(초) 기록이 가능합니다: 맨몸 운동에서 시간 모드를 고르면 홀드 시작/정지 타이머로 초가 기록되고, 기록된 홀드 세트는 초 단위로 수정할 수 있습니다",
        "업데이트 안내가 마지막으로 확인한 버전 이후의 모든 변경 내역을 한 번에 보여줍니다",
      ],
      en: [
        "Holds can now be timed inside a session: pick time mode on a bodyweight exercise and a start/stop timer records the seconds; logged hold sets are editable in seconds",
        "The update notice now shows every release since the version you last acknowledged, in one view",
      ],
      es: [
        "Los holds ahora se cronometran dentro de la sesión: elige el modo tiempo en un ejercicio de peso corporal y un temporizador de inicio/parada registra los segundos; las series de hold se editan en segundos",
        "El aviso de actualización ahora muestra todos los cambios desde la última versión que confirmaste, en una sola vista",
      ],
      pt: [
        "Os holds agora podem ser cronometrados na sessão: escolha o modo tempo num exercício de peso corporal e um cronômetro de iniciar/parar registra os segundos; séries de hold são editáveis em segundos",
        "O aviso de atualização agora mostra todas as mudanças desde a última versão que você confirmou, numa única tela",
      ],
      ja: [
        "セッション中でもホールド（秒）を記録できます。自重種目で時間モードを選ぶと開始/停止タイマーで秒数が記録され、記録済みホールドセットは秒単位で修正できます",
        "アップデート通知が、最後に確認したバージョン以降のすべての変更をまとめて表示するようになりました",
      ],
      zh: [
        "训练中也能记录保持（秒）：在自重动作中选择时间模式，用开始/停止计时器记录秒数；已记录的保持组可按秒修改",
        "更新提示现在会一次显示自你上次确认的版本以来的全部更新内容",
      ],
    },
  },
  {
    version: "1.10.0",
    date: "2026-08-15",
    notes: {
      ko: [
        "세션 탭에 추천 프로그램 카드가 생겼습니다: 최근 4주의 실제 운동 빈도와 세션 길이에 맞춘 분할을 제안하고, 미리보기 후 내 세션으로 추가할 수 있습니다",
        "추천 프로그램의 시작 무게는 기존 기록의 같은/비슷한 운동에서 보수적으로 가져와 자동 기입됩니다",
        "회복 주간이 2주(설정 가능)를 넘기면 자동으로 일반 모드로 돌아갑니다",
      ],
      en: [
        "The Session tab gains a recommended-programs card: splits tuned to your actual training frequency and session length over the last 4 weeks, with a preview and one-tap adoption",
        "Recommended programs auto-fill conservative starting loads taken from the same or similar lifts in your records",
        "Recovery mode now ends itself after 2 weeks (configurable) instead of waiting on the manual exit",
      ],
      es: [
        "La pestaña Sesión gana una tarjeta de programas recomendados: divisiones ajustadas a tu frecuencia y duración reales de las últimas 4 semanas, con vista previa y adopción en un toque",
        "Los programas recomendados rellenan cargas iniciales conservadoras tomadas de ejercicios iguales o similares de tus registros",
        "El modo de recuperación ahora termina solo tras 2 semanas (configurable) en lugar de esperar la salida manual",
      ],
      pt: [
        "A aba Sessão ganha um cartão de programas recomendados: divisões ajustadas à sua frequência e duração reais das últimas 4 semanas, com prévia e adoção em um toque",
        "Os programas recomendados preenchem cargas iniciais conservadoras tiradas de exercícios iguais ou parecidos dos seus registros",
        "O modo de recuperação agora termina sozinho após 2 semanas (configurável) em vez de esperar a saída manual",
      ],
      ja: [
        "セッションタブにおすすめプログラムカードが追加: 直近4週間の実際の頻度とセッション時間に合わせた分割を提案し、プレビューしてワンタップで追加できます",
        "おすすめプログラムの開始重量は、既存記録の同じ/近い種目から控えめに自動入力されます",
        "回復モードは2週間（設定可能）を過ぎると自動的に通常モードへ戻ります",
      ],
      zh: [
        "训练页新增推荐计划卡片：按最近4周的实际训练频率和时长推荐分化方案，可预览并一键添加",
        "推荐计划会从你记录中相同或相近的动作保守地自动填入起始重量",
        "恢复模式超过2周（可配置）后会自动回到正常模式",
      ],
    },
  },
  {
    version: "1.9.0",
    date: "2026-08-15",
    notes: {
      ko: [
        "하단 탭이 5개가 되었습니다: 새 '세션' 탭이 웨이트 세션을 전담하고, '오늘' 탭(유산소/맨몸/물/체중)은 세션 진행 중에도 언제든 열 수 있습니다",
        "시작 스플래시가 최소 1.2초 표시됩니다 (번쩍이고 사라지던 문제)",
        "회복 주간 종료 버튼에 확인 창이 생겨 실수 탭으로 회복 모드가 꺼지지 않습니다",
      ],
      en: [
        "The bottom bar now has 5 tabs: a new 'Session' tab owns the weights session, and the 'Today' tab (cardio/calisthenics/water/bodyweight) stays reachable mid-session",
        "The launch splash now shows for at least 1.2 seconds (it used to flash and vanish)",
        "The recovery-week exit button now asks for confirmation, so a stray tap cannot silently end recovery mode",
      ],
      es: [
        "La barra inferior ahora tiene 5 pestañas: la nueva pestaña 'Sesión' se encarga de la sesión de pesas, y la pestaña 'Hoy' (cardio/calistenia/agua/peso) queda accesible durante la sesión",
        "El splash de inicio ahora se muestra al menos 1,2 segundos (antes parpadeaba y desaparecía)",
        "El botón para terminar la semana de recuperación ahora pide confirmación, así un toque accidental no la apaga en silencio",
      ],
      pt: [
        "A barra inferior agora tem 5 abas: a nova aba 'Sessão' cuida da sessão de musculação, e a aba 'Hoje' (cardio/calistenia/água/peso) fica acessível durante a sessão",
        "A splash de abertura agora aparece por pelo menos 1,2 segundos (antes piscava e sumia)",
        "O botão de encerrar a semana de recuperação agora pede confirmação, então um toque acidental não a desliga em silêncio",
      ],
      ja: [
        "下部タブが5つになりました。新しい「セッション」タブがウェイトセッションを担当し、「今日」タブ（有酸素/自重/水分/体重）はセッション中でもいつでも開けます",
        "起動スプラッシュが最低1.2秒表示されます（一瞬で消えていた問題）",
        "回復週間の終了ボタンに確認ダイアログが付き、誤タップで回復モードが消えなくなりました",
      ],
      zh: [
        "底部标签栏增至5个：新的「训练」标签负责力量训练，「今日」标签（有氧/自重/饮水/体重）在训练进行中也随时可打开",
        "启动闪屏至少显示1.2秒（之前一闪而过）",
        "结束恢复周的按钮增加了确认弹窗，误触不会再悄悄关闭恢复模式",
      ],
    },
  },
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
