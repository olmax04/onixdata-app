/*
 * Ступени каскадного появления левой колонки auth-страниц.
 * Сами классы описаны в app/globals.css (.auth-enter + .auth-enter-N):
 * шаг 55 мс, длительность 450 мс, fill-mode: backwards.
 * Значения — литеральные строки: Tailwind сканирует исходники как текст и
 * вырезает классы, которых не нашёл, поэтому склеивать их на лету нельзя.
 */
export const authEnter = {
  logo: "auth-enter auth-enter-1",
  title: "auth-enter auth-enter-2",
  description: "auth-enter auth-enter-3",
  field: "auth-enter auth-enter-4",
  aside: "auth-enter auth-enter-5",
  submit: "auth-enter auth-enter-6",
  /*
   * На /forgot-password нет ни разделителя, ни OAuth, поэтому ступень 7
   * переиспользует ссылка «Вернуться ко входу», а ступень 8 не занята.
   */
  backLink: "auth-enter auth-enter-7",
  divider: "auth-enter auth-enter-7",
  oauth: "auth-enter auth-enter-8",
  altAction: "auth-enter auth-enter-9",
  copyright: "auth-enter auth-enter-10",
} as const

/*
 * Отклик кнопки на нажатие. transition-colors из buttonVariants попадает в ту
 * же группу twMerge, что и transition-*, поэтому перечисляем свойства явно —
 * иначе плавная смена фона на hover потерялась бы.
 */
export const authPress =
  "transition-[color,background-color,border-color,transform] active:scale-[0.98]"

/* Появление сообщения об ошибке валидации под полем. */
export const authFormMessage =
  "animate-in fade-in slide-in-from-top-1 duration-200"
