import { useMemo, useState } from 'react'
import { ArrowLeft, BookOpen, Copy, Info, Plus, Trash2 } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { foodDiaryFlags } from '../config/foodDiary.js'
import { foodDataSource, foodItems } from '../data/foodItems.js'
import { useAuth } from '../contexts/AuthContext'
import { useFoodDiaryPreview } from '../contexts/FoodDiaryPreviewContext'
import {
  calculateFoodDiaryMeal,
  mealTypes,
  searchFoodItems,
  symptomOptions,
} from '../lib/foodDiary.js'
import { localDate } from '../lib/patientData.js'
import { Card, Feedback, FormField, SelectField } from '../components/ui'

const scaleOptions = [
  { value: 1, label: '1 · Pouca' },
  { value: 2, label: '2 · Um pouco' },
  { value: 3, label: '3 · Moderada' },
  { value: 4, label: '4 · Bastante' },
  { value: 5, label: '5 · Muita' },
]

function numberLabel(value, unit) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)} ${unit}`
}

function mealTitle(type) {
  return mealTypes.find((meal) => meal.id === type)?.label ?? 'Refeição'
}

export default function FoodDiary() {
  const { isDemo } = useAuth()
  const { meals, preferences, addMeal, removeMeal } = useFoodDiaryPreview()
  const [date, setDate] = useState(localDate())
  const [type, setType] = useState('breakfast')
  const [time, setTime] = useState('08:00')
  const [query, setQuery] = useState('')
  const [grams, setGrams] = useState('100')
  const [items, setItems] = useState([])
  const [hungerBefore, setHungerBefore] = useState(3)
  const [satietyAfter, setSatietyAfter] = useState(3)
  const [symptoms, setSymptoms] = useState([])
  const [note, setNote] = useState('')
  const [hideNumbers, setHideNumbers] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const visibleMeals = useMemo(
    () => meals.filter((meal) => meal.date === date).sort((a, b) => a.time.localeCompare(b.time)),
    [date, meals],
  )
  const results = useMemo(() => searchFoodItems(query), [query])
  const showCarbs = preferences.showCarbs && !hideNumbers
  const showCalories = preferences.showCalories && !hideNumbers
  const dailyTotals = visibleMeals.reduce(
    (total, meal) => {
      const estimate = calculateFoodDiaryMeal(meal, preferences.carbMode)
      total.kcal += estimate.kcal
      total.carbs += estimate.carbs
      return total
    },
    { kcal: 0, carbs: 0 },
  )

  if (!isDemo || !foodDiaryFlags.previewVisible || !preferences.enabled)
    return <Navigate to="/habitos" replace />

  function selectFood(food) {
    const amount = Number(grams)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 2000) {
      setError('Informe uma quantidade entre 1 e 2.000 g.')
      return
    }
    setItems((current) => [...current, { foodId: food.id, grams: amount }])
    setQuery('')
    setError('')
    setMessage('')
  }

  function repeatMeal() {
    const previous = [...meals].filter((meal) => meal.date === date).sort((a, b) => b.time.localeCompare(a.time))[0]
    if (!previous) {
      setMessage('Ainda não há refeição registrada neste dia para repetir.')
      return
    }
    setType(previous.type)
    setItems(previous.items.map((item) => ({ ...item })))
    setHungerBefore(previous.hungerBefore)
    setSatietyAfter(previous.satietyAfter)
    setSymptoms([...previous.symptoms])
    setNote(previous.note)
    setMessage('Refeição copiada para o formulário. Confira o horário e ajuste o que desejar.')
    setError('')
  }

  function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      addMeal({ date, type, time, items, hungerBefore, satietyAfter, symptoms, note })
      setItems([])
      setSymptoms([])
      setNote('')
      setMessage('Refeição incluída nesta simulação. Nada foi enviado ou salvo.')
    } catch (failure) {
      setError(failure.message || 'Não foi possível incluir a refeição.')
    }
  }

  const formattedMeals = visibleMeals.map((meal) => ({
    ...meal,
    estimate: calculateFoodDiaryMeal(meal, preferences.carbMode),
  }))

  return (
    <div className="space-y-5">
      <Link to="/habitos" className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-soma-700">
        <ArrowLeft size={18} aria-hidden="true" /> Voltar a Hábitos
      </Link>

      <header>
        <h1 className="text-2xl font-semibold text-soma-950">Diário alimentar</h1>
        <p className="mt-1 text-sm text-soma-700">Um registro simples, no seu ritmo</p>
      </header>

      <div className="rounded-2xl border border-soma-200 bg-soma-50 p-4 text-sm leading-6 text-soma-800">
        <p className="font-semibold">Prévia demonstrativa · dados fictícios</p>
        <p className="mt-1">Este ensaio fica somente na memória desta tela e não é enviado nem compartilhado. Não use dados pessoais.</p>
      </div>

      <Card className="border border-soma-100">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 shrink-0 text-soma-600" size={20} aria-hidden="true" />
          <div className="text-sm leading-6 text-soma-700">
            <p className="font-semibold text-soma-900">Sobre as estimativas</p>
            <p className="mt-1">Os valores são aproximados e dependem do alimento escolhido e do peso informado. Receitas, marcas e preparo podem mudar a composição. Esta prévia não avalia a quantidade consumida nem define uma meta.</p>
            <p className="mt-2 font-semibold">Não use a estimativa de carboidratos para calcular dose de insulina. Siga a orientação da sua equipe de saúde.</p>
          </div>
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <FormField
            label="Dia do registro"
            type="date"
            value={date}
            max={localDate()}
            onChange={(event) => setDate(event.target.value)}
            className="min-w-[190px] flex-1"
          />
          <button type="button" onClick={repeatMeal} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-soma-200 px-3 py-2 text-sm font-semibold text-soma-800">
            <Copy size={17} aria-hidden="true" /> Repetir refeição
          </button>
        </div>
        {(showCarbs || showCalories) && (
          <label className="mt-4 flex items-start gap-3 rounded-xl bg-soma-50 p-3 text-sm text-soma-800">
            <input type="checkbox" checked={hideNumbers} onChange={(event) => setHideNumbers(event.target.checked)} className="mt-1 h-4 w-4 accent-soma-800" />
            Ocultar estimativas nesta tela
          </label>
        )}
        <p className="mt-3 text-xs leading-5 text-soma-600">
          {preferences.carbMode === 'total' ? 'Carboidrato total' : 'Carboidrato disponível'} · informação liberada na simulação pela profissional fictícia. Você pode ocultá-la.
        </p>
      </Card>

      {visibleMeals.length > 0 && (
        <section className="space-y-3" aria-labelledby="daily-records-title">
          <div className="flex items-end justify-between gap-2">
            <h2 id="daily-records-title" className="text-lg font-semibold text-soma-900">Registros do dia</h2>
            <span className="text-xs text-soma-600">{visibleMeals.length} {visibleMeals.length === 1 ? 'refeição' : 'refeições'}</span>
          </div>
          {formattedMeals.map((meal) => (
            <Card key={meal.id} className="border border-soma-100">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-soma-600">{meal.time}</p>
                  <h3 className="font-semibold text-soma-900">{mealTitle(meal.type)}</h3>
                </div>
                <button type="button" onClick={() => removeMeal(meal.id)} aria-label={`Remover ${mealTitle(meal.type)}`} className="rounded-lg p-2 text-soma-600 hover:bg-soma-50">
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-soma-700">
                {meal.items.map((item, index) => {
                  const food = foodItems.find(({ id }) => id === item.foodId)
                  return <li key={`${item.foodId}-${index}`}>{food?.name ?? 'Alimento'} · {numberLabel(item.grams, 'g')}</li>
                })}
              </ul>
              {(showCarbs || showCalories) && (
                <p className="mt-3 border-t border-soma-100 pt-3 text-sm font-medium text-soma-800">
                  {showCarbs && <span>aprox. {numberLabel(meal.estimate.carbs, 'g')} de carboidratos</span>}
                  {showCarbs && showCalories && <span> · </span>}
                  {showCalories && <span>aprox. {numberLabel(meal.estimate.kcal, 'kcal')}</span>}
                </p>
              )}
              <p className="mt-3 text-xs text-soma-600">Fome antes: {meal.hungerBefore}/5 · Saciedade depois: {meal.satietyAfter}/5</p>
              {meal.symptoms.length > 0 && <p className="mt-1 text-xs text-soma-600">Sintomas registrados: {meal.symptoms.map((id) => symptomOptions.find((item) => item.id === id)?.label).filter(Boolean).join(', ')}</p>}
              {meal.note && <p className="mt-2 whitespace-pre-wrap text-sm text-soma-700">{meal.note}</p>}
            </Card>
          ))}
          {(showCarbs || showCalories) && (
            <div className="rounded-2xl bg-soma-100 p-4 text-sm font-semibold text-soma-900">
              Total aproximado do dia: {showCarbs && `${numberLabel(dailyTotals.carbs, 'g')} de carboidratos`}{showCarbs && showCalories && ' · '}{showCalories && `${numberLabel(dailyTotals.kcal, 'kcal')}`}
            </div>
          )}
        </section>
      )}

      <Card>
        <h2 className="text-lg font-semibold text-soma-900">Adicionar refeição</h2>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Tipo de refeição" value={type} onChange={(event) => setType(event.target.value)}>
              {mealTypes.map((meal) => <option key={meal.id} value={meal.id}>{meal.label}</option>)}
            </SelectField>
            <FormField label="Horário" type="time" value={time} onChange={(event) => setTime(event.target.value)} required />
          </div>

          <div>
            <label htmlFor="food-search" className="block text-sm font-medium text-soma-800">Buscar alimento</label>
            <input id="food-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: arroz, feijão, cuscuz" className="mt-2 w-full rounded-xl border border-soma-200 bg-white px-4 py-3 text-soma-900" autoComplete="off" />
            <div className="mt-2 flex flex-wrap gap-2" aria-label="Alimentos disponíveis na prévia">
              {results.map((food) => (
                <button key={food.id} type="button" onClick={() => selectFood(food)} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-soma-200 bg-white px-3 py-2 text-xs font-medium text-soma-800 hover:bg-soma-50">
                  <Plus size={14} aria-hidden="true" /> {food.name}
                </button>
              ))}
              {results.length === 0 && query && <p className="text-sm text-soma-600">Nenhum item desta seleção corresponde à busca.</p>}
            </div>
          </div>

          <FormField label="Quantidade do próximo alimento (g)" type="number" min="1" max="2000" step="1" value={grams} onChange={(event) => setGrams(event.target.value)} />

          {items.length > 0 && (
            <div className="rounded-2xl bg-soma-50 p-4">
              <p className="text-sm font-semibold text-soma-900">Alimentos da refeição</p>
              <ul className="mt-2 space-y-2">
                {items.map((item, index) => {
                  const food = foodItems.find(({ id }) => id === item.foodId)
                  return (
                    <li key={`${item.foodId}-${index}`} className="flex items-center justify-between gap-3 text-sm text-soma-800">
                      <span>{food?.name} · {numberLabel(item.grams, 'g')}</span>
                      <button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remover ${food?.name}`} className="p-1 text-soma-600"><Trash2 size={17} aria-hidden="true" /></button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Fome antes (1 a 5)" value={hungerBefore} onChange={(event) => setHungerBefore(Number(event.target.value))}>
              {scaleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
            <SelectField label="Saciedade depois (1 a 5)" value={satietyAfter} onChange={(event) => setSatietyAfter(Number(event.target.value))}>
              {scaleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-soma-800">Sintomas (opcional)</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {symptomOptions.map((symptom) => (
                <label key={symptom.id} className="flex items-center gap-2 rounded-xl bg-soma-50 px-3 py-2 text-sm text-soma-800">
                  <input type="checkbox" checked={symptoms.includes(symptom.id)} onChange={(event) => setSymptoms((current) => event.target.checked ? [...current, symptom.id] : current.filter((id) => id !== symptom.id))} className="h-4 w-4 accent-soma-800" />
                  {symptom.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block text-sm font-medium text-soma-800">
            Observação (opcional)
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-soma-200 bg-white px-4 py-3 text-soma-900" placeholder="Se quiser, registre algo sobre esta refeição." />
            <span className="mt-1 block text-right text-xs text-soma-600">{note.length}/500</span>
          </label>

          <Feedback error={error} message={message} />
          <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-soma-800 px-5 py-3 font-semibold text-white">
            <Plus size={19} aria-hidden="true" /> Incluir nesta simulação
          </button>
        </form>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <BookOpen size={20} className="mt-0.5 shrink-0 text-soma-600" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-soma-900">Fontes e limites</h2>
            <p className="mt-2 text-sm leading-6 text-soma-700">Esta seleção usa valores por 100 g da TACO. A SBD não é usada como fonte de valores nesta prévia; o link abaixo leva ao material oficial.</p>
            <a href={foodDataSource.url} target="_blank" rel="noreferrer" className="mt-3 block text-sm font-semibold text-soma-700 underline">Consultar a TACO no site da UNICAMP</a>
            <a href="https://diabetes.org.br/e-book/manual-de-contagem-de-carboidratos/" target="_blank" rel="noreferrer" className="mt-2 block text-sm font-semibold text-soma-700 underline">Consultar o manual da SBD no site oficial</a>
            <p className="mt-3 text-xs leading-5 text-soma-600">Sem estimativa por foto nesta versão: nenhuma imagem é coletada, enviada ou armazenada.</p>
          </div>
        </div>
      </Card>

      <p className="px-1 text-xs leading-5 text-soma-600">
        Precisa de apoio? Converse com sua equipe de saúde. Se quiser falar com o CVV, ligue gratuitamente para{' '}
        <a href="tel:188" className="font-semibold text-soma-700 underline">188</a>{' '}
        ou acesse o <a href="https://cvv.org.br/ligue-188-3/" target="_blank" rel="noreferrer" className="font-semibold text-soma-700 underline">site oficial</a>.
      </p>
    </div>
  )
}
