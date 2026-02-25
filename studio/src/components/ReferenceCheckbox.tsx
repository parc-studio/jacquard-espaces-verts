import { AddIcon } from '@sanity/icons'
import { Box, Button, Card, Checkbox, Flex, Grid, Stack, Text } from '@sanity/ui'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ArrayOfObjectsInputProps,
  ObjectInputProps,
  Reference,
  ReferenceSchemaType,
} from 'sanity'
import { set, unset, useClient } from 'sanity'

interface ReferenceItem {
  _id: string
  title?: string
}

/**
 * Detect whether the component is used on an array field or a single reference field.
 */
function isArrayInput(
  props: ArrayOfObjectsInputProps | ObjectInputProps
): props is ArrayOfObjectsInputProps {
  return props.schemaType.jsonType === 'array'
}

/**
 * Extract reference target types + preview projections from schema,
 * supporting both array-of-references and single-reference fields.
 */
function useSchemaInfo(props: ArrayOfObjectsInputProps | ObjectInputProps) {
  const previewProjections = useMemo(() => {
    if (isArrayInput(props)) {
      const titles = props.schemaType.of.flatMap((type) =>
        'to' in type ? (type.to?.flatMap((to) => to.preview?.select?.title ?? []) ?? []) : []
      )
      return titles.length ? titles.join(',') : 'title'
    }
    // Single reference: schema has "to" directly
    const st = props.schemaType as ReferenceSchemaType
    const titles: string[] = (st.to ?? []).flatMap((to) => to.preview?.select?.title ?? [])
    return titles.length ? titles.join(',') : 'title'
  }, [props.schemaType])

  const referenceTypes = useMemo(() => {
    if (isArrayInput(props)) {
      return props.schemaType.of
        .flatMap((type) => ('to' in type ? type.to?.map((to) => to.name) : []))
        .filter(Boolean)
    }
    const st = props.schemaType as ReferenceSchemaType
    return (st.to ?? []).map((to) => to.name).filter(Boolean)
  }, [props.schemaType])

  return { previewProjections, referenceTypes }
}

/**
 * Renders a list of checkbox items based on documents that match the schema's "reference" fields.
 * Works for both array-of-references and single-reference fields.
 * For single references, selecting a new item replaces the previous one.
 * Includes a button to create new items directly from the field.
 */
export function ReferenceCheckbox(props: ArrayOfObjectsInputProps | ObjectInputProps) {
  const [referenceItems, setReferenceItems] = useState<ReferenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const client = useClient({ apiVersion: '2025-01-12' })
  const isArray = isArrayInput(props)
  const { previewProjections, referenceTypes } = useSchemaInfo(props)

  // Fetch reference items on mount or if schema changes
  useEffect(() => {
    const fetchData = async () => {
      if (!referenceTypes.length) {
        setLoading(false)
        return
      }
      const query = `*[_type in $types] | order(title asc) {
        _id,
        "title": coalesce(${previewProjections}, title, name)
      } | order(title asc)`
      try {
        const items: ReferenceItem[] = await client.fetch(query, { types: referenceTypes })
        setReferenceItems(items)
      } catch (error) {
        console.error('Failed to fetch reference items:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [client, referenceTypes, previewProjections])

  /**
   * Toggles a reference. For arrays: adds/removes from the list.
   * For single references: selects or deselects the item.
   */
  const handleToggle = useCallback(
    (itemId: string) => {
      if (isArray) {
        const arrayProps = props as ArrayOfObjectsInputProps
        const currentValue = arrayProps.value ?? []
        const exists = currentValue.some((val) => '_ref' in val && val._ref === itemId)

        const newValue = exists
          ? currentValue.filter((val) => '_ref' in val && val._ref !== itemId)
          : [
              ...currentValue,
              {
                _key: itemId,
                _type: 'reference',
                _ref: itemId,
              },
            ]

        props.onChange(set(newValue))
      } else {
        // Single reference: toggle on/off
        const currentRef = (props.value as Reference | undefined)?._ref
        if (currentRef === itemId) {
          props.onChange(unset())
        } else {
          props.onChange(
            set({
              _type: 'reference',
              _ref: itemId,
            })
          )
        }
      }
    },
    [props, isArray]
  )

  /**
   * Opens the Sanity Studio create-intent URL for the first reference type in a
   * new tab. The path is resolved from the origin root so it works regardless of
   * which studio pane is currently active.
   */
  const handleCreate = useCallback(() => {
    if (!referenceTypes.length) return
    const type = referenceTypes[0]
    const intentPath = `/intent/create/type=${encodeURIComponent(type)}/`
    const url = new URL(intentPath, window.location.origin)
    window.open(url.toString(), '_blank')
  }, [referenceTypes])

  /**
   * Check if an item is currently selected.
   */
  const isItemChecked = useCallback(
    (itemId: string): boolean => {
      if (isArray) {
        const arrayProps = props as ArrayOfObjectsInputProps
        return arrayProps.value?.some((val) => '_ref' in val && val._ref === itemId) || false
      }
      return (props.value as Reference | undefined)?._ref === itemId
    },
    [props, isArray]
  )

  if (loading) {
    return (
      <Card padding={3} tone="transparent">
        <Text size={1} muted>
          Loading…
        </Text>
      </Card>
    )
  }

  if (!referenceItems.length) {
    return (
      <Stack space={3}>
        <Card padding={3} tone="transparent">
          <Text size={1} muted>
            No items available
          </Text>
        </Card>
        <Flex>
          <Button
            icon={AddIcon}
            text="Create"
            mode="ghost"
            tone="primary"
            onClick={handleCreate}
            fontSize={0}
            padding={2}
          />
        </Flex>
      </Stack>
    )
  }

  return (
    <Stack space={3}>
      <Grid columns={[1, 1, 2]} gap={2}>
        {referenceItems.map((item) => {
          const isChecked = isItemChecked(item._id)
          return (
            <Card key={item._id} padding={2} radius={2}>
              <Flex align="center">
                <Checkbox
                  id={item._id}
                  checked={isChecked}
                  onChange={() => handleToggle(item._id)}
                />
                <Box flex={1} paddingLeft={3}>
                  <Text size={1}>
                    <label htmlFor={item._id} style={{ cursor: 'pointer' }}>
                      {item.title || 'Untitled'}
                    </label>
                  </Text>
                </Box>
              </Flex>
            </Card>
          )
        })}
      </Grid>
      <Flex>
        <Button
          icon={AddIcon}
          text="Create"
          mode="ghost"
          tone="primary"
          onClick={handleCreate}
          fontSize={0}
          padding={2}
        />
      </Flex>
    </Stack>
  )
}
