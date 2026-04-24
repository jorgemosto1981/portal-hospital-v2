import DataOperationFeedback from "../../../components/ui/DataOperationFeedback.jsx";

export function StatusSection({ projectId, authAppName, user, userPending, firestoreOp }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-xl font-semibold text-slate-800">Estado</h2>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-3 text-base min-[24rem]:grid-cols-[minmax(0,7rem)_1fr]">
        <dt className="font-semibold text-slate-600 sm:pt-0.5">Proyecto</dt>
        <dd className="break-words text-slate-800">
          <code className="text-sm">{projectId}</code>
        </dd>
        <dt className="font-semibold text-slate-600 sm:pt-0.5">Auth app</dt>
        <dd>
          <code className="text-sm">{authAppName}</code>
        </dd>
        <dt className="font-semibold text-slate-600 sm:pt-0.5">Sesión</dt>
        <dd>
          {userPending ? (
            <DataOperationFeedback
              status="loading"
              message="Comprobando autenticación (Auth)…"
            />
          ) : user ? (
            <p className="text-slate-800">
              <code className="text-sm break-all">{user.uid}</code>
              {user.email ? (
                <>
                  {" "}
                  · <code className="text-sm">{user.email}</code>
                </>
              ) : null}
            </p>
          ) : (
            "Sin sesión"
          )}
        </dd>
        <dt className="font-semibold text-slate-600 sm:pt-0.5">Firestore</dt>
        <dd>
          <DataOperationFeedback
            status={firestoreOp.status}
            message={firestoreOp.message}
          />
        </dd>
      </dl>
    </section>
  );
}
