import { StubPage } from '../_components/StubPage'

export default function AddJapanesePage(): React.JSX.Element {
  return (
    <StubPage
      title="Add Japanese"
      links={[
        { href: '/add/review', label: 'Generated Card Review' },
        { href: '/today',      label: 'Today' },
      ]}
    />
  )
}
