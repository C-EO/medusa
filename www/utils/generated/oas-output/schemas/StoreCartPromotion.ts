/**
 * @schema StoreCartPromotion
 * type: object
 * description: The promotion's promotions.
 * x-schemaName: StoreCartPromotion
 * required:
 *   - id
 * properties:
 *   id:
 *     type: string
 *     title: id
 *     description: The promotion's ID.
 *   code:
 *     type: string
 *     title: code
 *     description: The promotion's code.
 *   is_automatic:
 *     type: boolean
 *     title: is_automatic
 *     description: The promotion's is automatic.
 *   application_method:
 *     type: object
 *     description: The promotion's application method.
 *     required:
 *       - value
 *       - type
 *       - currency_code
 *     properties:
 *       value:
 *         type: string
 *         title: value
 *         description: The application method's value.
 *       type:
 *         type: string
 *         description: The application method's type.
 *         enum:
 *           - fixed
 *           - percentage
 *       currency_code:
 *         type: string
 *         title: currency_code
 *         description: The application method's currency code.
 * 
*/

