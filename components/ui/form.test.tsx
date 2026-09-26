import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const schema = z.object({
  email: z.string().min(1, "Укажите email"),
})

function TestForm({
  withDescription = false,
  withMessage = true,
}: {
  withDescription?: boolean
  withMessage?: boolean
}) {
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})} noValidate>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              {withDescription && (
                <FormDescription>Рабочая почта.</FormDescription>
              )}
              {withMessage && <FormMessage />}
            </FormItem>
          )}
        />
        <button type="submit">Отправить</button>
      </form>
    </Form>
  )
}

/** Все id из aria-describedby должны указывать на существующие узлы. */
function describedByIds(element: HTMLElement) {
  const value = element.getAttribute("aria-describedby")
  return value ? value.split(" ").filter(Boolean) : []
}

describe("FormControl aria-describedby", () => {
  it("не ссылается на описание, которого нет", async () => {
    render(<TestForm />)

    const input = screen.getByLabelText("Email")

    await waitFor(() => {
      expect(describedByIds(input)).toEqual([])
    })
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("ссылается на описание, когда оно отрисовано", async () => {
    render(<TestForm withDescription />)

    const input = screen.getByLabelText("Email")
    const description = screen.getByText("Рабочая почта.")

    await waitFor(() => {
      expect(describedByIds(input)).toEqual([description.id])
    })
  })

  it("добавляет сообщение об ошибке и не теряет описание", async () => {
    const user = userEvent.setup()
    render(<TestForm withDescription />)

    await user.click(screen.getByRole("button", { name: "Отправить" }))

    const input = screen.getByLabelText("Email")
    await waitFor(() => {
      expect(describedByIds(input)).toHaveLength(2)
    })

    expect(input).toHaveAttribute("aria-invalid", "true")
    for (const id of describedByIds(input)) {
      expect(document.getElementById(id)).not.toBeNull()
    }
    expect(screen.getByText("Укажите email")).toBeInTheDocument()
  })

  it("без описания ссылается только на сообщение об ошибке", async () => {
    const user = userEvent.setup()
    render(<TestForm />)

    const input = screen.getByLabelText("Email")
    await user.click(screen.getByRole("button", { name: "Отправить" }))

    const message = await screen.findByText("Укажите email")

    await waitFor(() => {
      expect(describedByIds(input)).toEqual([message.id])
    })
  })

  it("при ошибке без FormMessage не ссылается на несуществующее сообщение", async () => {
    const user = userEvent.setup()
    render(<TestForm withMessage={false} />)

    const input = screen.getByLabelText("Email")
    await user.click(screen.getByRole("button", { name: "Отправить" }))

    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true")
    })

    expect(screen.queryByText("Укажите email")).not.toBeInTheDocument()
    expect(describedByIds(input)).toEqual([])
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("при ошибке без FormMessage сохраняет ссылку на описание", async () => {
    const user = userEvent.setup()
    render(<TestForm withDescription withMessage={false} />)

    const input = screen.getByLabelText("Email")
    const description = screen.getByText("Рабочая почта.")
    await user.click(screen.getByRole("button", { name: "Отправить" }))

    await waitFor(() => {
      expect(input).toHaveAttribute("aria-invalid", "true")
    })

    expect(describedByIds(input)).toEqual([description.id])
  })
})
