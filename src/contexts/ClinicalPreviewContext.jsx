import { createContext, useContext, useState } from 'react'
import { useAuth } from './AuthContext'
import { clinicalPreviewEnabled } from '../config/clinicalPreview'
import { exampleRecords } from '../lib/clinicalModules'
import {
  appendClinicalRecord,
  changeClinicalPermission,
  clinicalPreviewStore,
  closeClinicalModule,
  configureClinicalModule,
  emptyClinicalPreview,
} from '../lib/clinicalPreviewStore'

const ClinicalPreviewContext = createContext(null)
export function ClinicalPreviewProvider({ children }) {
  const { isDemo } = useAuth()
  const enabled = clinicalPreviewEnabled && isDemo
  const [data, setData] = useState(() =>
    enabled ? clinicalPreviewStore.read() : emptyClinicalPreview(),
  )
  function update(change) {
    if (!enabled)
      throw new Error('Disponível somente na prévia com dados fictícios.')
    setData(clinicalPreviewStore.save(change(clinicalPreviewStore.read())))
  }
  return (
    <ClinicalPreviewContext.Provider
      value={{
        enabled,
        data,
        grant: (doctorId, allowed) =>
          update((state) => changeClinicalPermission(state, doctorId, allowed)),
        configure: (doctorId, moduleId, config) =>
          update((state) =>
            configureClinicalModule(state, doctorId, moduleId, config),
          ),
        close: (moduleId) =>
          update((state) => closeClinicalModule(state, moduleId)),
        save: (kind, values) =>
          update((state) =>
            appendClinicalRecord(
              state,
              kind,
              values,
              `record-${crypto.randomUUID()}`,
            ),
          ),
        examples: (moduleId) =>
          update((state) =>
            exampleRecords(moduleId).reduce(
              (current, row, index) =>
                appendClinicalRecord(
                  current,
                  row.kind,
                  row,
                  `example-${moduleId}-${index}`,
                ),
              state,
            ),
          ),
      }}
    >
      {children}
    </ClinicalPreviewContext.Provider>
  )
}
export function useClinicalPreview() {
  return useContext(ClinicalPreviewContext)
}
