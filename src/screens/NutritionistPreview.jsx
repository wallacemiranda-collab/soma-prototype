import { ArrowLeft, Eye, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { foodDiaryFlags } from '../config/foodDiary.js'
import { useAuth } from '../contexts/AuthContext'
import { useFoodDiaryPreview } from '../contexts/FoodDiaryPreviewContext'
import { foodItems } from '../data/foodItems.js'
import {
  calculateFoodDiaryMeal,
  mealTypes,
  symptomOptions,
} from '../lib/foodDiary.js'
import { Card, SelectField } from '../components/ui'

function foodLabel(id) {
  return foodItems.find((food) => food.id === id)?.name ?? 'Alimento'
}

function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)
}

function formatDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(
    new Date(`${value}T12:00:00`),
  )
}

export default function NutritionistPreview() {
  const { isDemo } = useAuth()
  const { meals, preferences, updatePreferences } = useFoodDiaryPreview()
  if (!isDemo || !foodDiaryFlags.previewVisible) return <Navigate to="/habitos" replace />

  const days = new Set(meals.map((meal) => meal.date)).size
  const mealCounts = meals.reduce((result, meal) => {
    result[meal.date] = (result[meal.date] ?? 0) + 1
    return result
  }, {})
  const mealsPerDay = Object.values(mealCounts)
  const averageMeals = mealsPerDay.length
    ? mealsPerDay.reduce((sum, value) => sum + value, 0) / mealsPerDay.length
    : 0

  return (
    <div className="space-y-5">
      <Link to="/alimentacao" className="inline-flex items-center gap-2 py-2 text-sm font-semibold text-soma-700">
        <ArrowLeft size={18} aria-hidden="true" /> Voltar ao diário
      </Link>
      <header>
        <p className="text-sm font-medium text-soma-600">Área profissional · prévia fictícia</p>
        <h1 className="mt-1 text-2xl font-semibold text-soma-950">Visão da nutricionista</h1>
        <p className="mt-1 text-sm text-soma-700">Paciente: Demonstração Endo +</p>
      </header>

      <div className="rounded-2xl border border-soma-200 bg-soma-50 p-4 text-sm leading-6 text-soma-800">
        <p className="font-semibold">Nenhum paciente real está conectado</p>
        <p className="mt-1">A autorização e o compartilhamento são apenas simulados nesta tela. Nenhum acesso, comentário ou dado é gravado no serviço.</p>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={19} className="text-soma-600" aria-hidden="true" />
          <h2 className="font-semibold text-soma-900">Preferências por paciente</h2>
        </div>
        <p className="mt-2 text-sm leading-6 text-soma-700">Nesta demonstração, estes controles alteram apenas a visualização fictícia do diário.</p>
        <div className="mt-4 space-y-3">
          <label className="flex items-start gap-3 rounded-xl bg-soma-50 p-3 text-sm text-soma-800">
            <input type="checkbox" checked={preferences.enabled} onChange={(event) => updatePreferences({ enabled: event.target.checked })} className="mt-1 h-4 w-4 accent-soma-800" />
            Disponibilizar a seção de diário ao paciente
          </label>
          <label className="flex items-start gap-3 rounded-xl bg-soma-50 p-3 text-sm text-soma-800">
            <input type="checkbox" checked={preferences.showCarbs} onChange={(event) => updatePreferences({ showCarbs: event.target.checked })} className="mt-1 h-4 w-4 accent-soma-800" />
            Liberar estimativas de carboidratos
          </label>
          <label className="flex items-start gap-3 rounded-xl bg-soma-50 p-3 text-sm text-soma-800">
            <input type="checkbox" checked={preferences.showCalories} onChange={(event) => updatePreferences({ showCalories: event.target.checked })} className="mt-1 h-4 w-4 accent-soma-800" />
            Liberar estimativas de calorias
          </label>
          <SelectField label="Base da estimativa de carboidratos" value={preferences.carbMode} onChange={(event) => updatePreferences({ carbMode: event.target.value })}>
            <option value="total">Carboidrato total (padrão provisório)</option>
            <option value="disponivel">Carboidrato disponível (total menos fibra)</option>
          </SelectField>
        </div>
        <p className="mt-4 text-xs leading-5 text-soma-600">O paciente pode ocultar números liberados. Não pode ativar uma informação desabilitada pela equipe.</p>
      </Card>

      <section aria-labelledby="weekly-summary-title">
        <h2 id="weekly-summary-title" className="mb-3 text-lg font-semibold text-soma-900">Resumo descritivo da simulação</h2>
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4"><p className="text-xs text-soma-600">Dias com registro</p><p className="mt-1 text-2xl font-semibold text-soma-900">{days}</p></Card>
          <Card className="p-4"><p className="text-xs text-soma-600">Refeições por dia registrado</p><p className="mt-1 text-2xl font-semibold text-soma-900">{formatNumber(averageMeals)}</p></Card>
        </div>
        <p className="mt-3 text-xs leading-5 text-soma-600">Resumo de registros fictícios, sem julgamento alimentar ou comparação com metas.</p>
      </section>

      <section className="space-y-3" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="text-lg font-semibold text-soma-900">Linha do tempo</h2>
        {meals.length ? [...meals].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).map((meal) => {
          const estimate = calculateFoodDiaryMeal(meal, preferences.carbMode)
          const type = mealTypes.find((item) => item.id === meal.type)?.label ?? 'Refeição'
          return (
            <Card key={meal.id}>
              <p className="text-xs text-soma-600">{formatDate(meal.date)} · {meal.time}</p>
              <h3 className="mt-1 font-semibold text-soma-900">{type}</h3>
              <ul className="mt-2 space-y-1 text-sm text-soma-700">
                {meal.items.map((item, index) => <li key={`${item.foodId}-${index}`}>{foodLabel(item.foodId)} · {formatNumber(item.grams)} g</li>)}
              </ul>
              <p className="mt-3 text-xs text-soma-600">Fome antes {meal.hungerBefore}/5 · saciedade depois {meal.satietyAfter}/5</p>
              {meal.symptoms.length > 0 && <p className="mt-1 text-xs text-soma-600">Sintomas registrados: {meal.symptoms.map((id) => symptomOptions.find((item) => item.id === id)?.label).filter(Boolean).join(', ')}</p>}
              {meal.note && <p className="mt-2 text-sm text-soma-700">{meal.note}</p>}
              {(preferences.showCarbs || preferences.showCalories) && (
                <p className="mt-3 text-sm text-soma-700">
                  {preferences.showCarbs && `aprox. ${formatNumber(estimate.carbs)} g de carboidratos`}
                  {preferences.showCarbs && preferences.showCalories && ' · '}
                  {preferences.showCalories && `aprox. ${formatNumber(estimate.kcal)} kcal`}
                </p>
              )}
            </Card>
          )
        }) : <Card><p className="text-sm text-soma-700">Ainda não há registros nesta simulação.</p></Card>}
      </section>

      <Card>
        <div className="flex items-start gap-3">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-soma-600" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-soma-900">Privacidade e plano alimentar</h2>
            <p className="mt-2 text-sm leading-6 text-soma-700">Na versão conectada, o diário exigirá autorização independente do paciente para cada profissional e deverá ser revogável. Isso ainda não está ligado a contas reais.</p>
            <p className="mt-2 text-sm leading-6 text-soma-700">Envio de plano em PDF não está ativo nesta prévia. Nenhum arquivo é selecionado, enviado ou armazenado.</p>
          </div>
        </div>
      </Card>

      <p className="flex items-center gap-2 px-1 text-xs leading-5 text-soma-600"><Eye size={16} aria-hidden="true" /> Esta tela é somente leitura para a nutricionista, exceto pelos controles fictícios de visualização acima.</p>
    </div>
  )
}
