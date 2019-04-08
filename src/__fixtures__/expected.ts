export default {
  type: 'document',
  loc: {
    start: { line: 0, column: 0 },
    end: { line: 34, column: 0 }
  },
  body: [
    {
      type: 'comment',
      loc: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 26 }
      },
      raw: '# This is a TOML document.'
    },
    {
      type: 'keyvalue',
      loc: {
        start: { line: 3, column: 0 },
        end: { line: 3, column: 22 }
      },
      key: {
        type: 'key',
        loc: {
          start: { line: 3, column: 0 },
          end: { line: 3, column: 5 }
        },
        raw: 'title',
        value: ['title']
      },
      value: {
        type: 'string',
        loc: {
          start: { line: 3, column: 8 },
          end: { line: 3, column: 22 }
        },
        raw: `"TOML Example"`,
        value: 'TOML Example'
      },
      equals: 6,
      comments: null
    },
    {
      type: 'table',
      loc: {
        start: { line: 5, column: 0 },
        end: { line: 7, column: 51 }
      },
      key: {
        type: 'tablekey',
        loc: {
          start: { line: 5, column: 0 },
          end: { line: 5, column: 7 }
        },
        value: {
          type: 'key',
          loc: {
            start: { line: 5, column: 1 },
            end: { line: 5, column: 6 }
          },
          raw: 'owner',
          value: ['owner']
        },
        comment: null
      },
      items: [
        {
          type: 'keyvalue',
          loc: {
            start: { line: 6, column: 0 },
            end: { line: 6, column: 27 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 6, column: 0 },
              end: { line: 6, column: 4 }
            },
            raw: 'name',
            value: ['name']
          },
          equals: 5,
          value: {
            type: 'string',
            loc: {
              start: { line: 6, column: 7 },
              end: { line: 6, column: 27 },
              raw: `"Tom Preston-Werner"`,
              value: 'Tom Preston-Werner'
            }
          },
          comments: null
        },
        {
          type: 'keyvalue',
          loc: {
            start: { line: 7, column: 0 },
            end: { line: 7, column: 51 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 7, column: 0 },
              end: { line: 7, column: 3 }
            },
            raw: 'dob',
            value: ['dob']
          },
          equals: 4,
          value: {
            type: 'datetime',
            loc: {
              start: { line: 7, column: 6 },
              end: { line: 7, column: 31 }
            },
            raw: '1979-05-27T07:32:00-08:00',
            value: new Date('1979-05-27T07:32:00-08:00')
          },
          comments: [
            {
              type: 'comment',
              loc: {
                start: { line: 7, column: 32 },
                end: { line: 7, column: 51 }
              },
              raw: '# First class dates'
            }
          ]
        }
      ]
    },
    {
      type: 'table',
      loc: {
        start: { line: 9, column: 0 },
        end: { line: 13, column: 14 }
      },
      key: {
        type: 'tablekey',
        loc: {
          start: { line: 9, column: 0 },
          end: { line: 9, column: 10 }
        },
        value: {
          type: 'key',
          loc: {
            start: { line: 9, column: 1 },
            end: { line: 9, column: 9 }
          },
          raw: 'database',
          value: ['database']
        },
        comment: null
      },
      items: [
        {
          type: 'keyvalue',
          loc: {
            start: { line: 10, column: 0 },
            end: { line: 10, column: 22 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 10, column: 0 },
              end: { line: 10, column: 6 }
            },
            raw: 'server',
            value: ['server']
          },
          equals: 7,
          value: {
            type: 'string',
            loc: {
              start: { line: 10, column: 10 },
              end: { line: 10, column: 22 }
            },
            raw: `"192.168.1.1"`,
            value: '192.168.1.1'
          },
          comments: null
        },
        {
          type: 'keyvalue',
          loc: {
            start: { line: 11, column: 0 },
            end: { line: 11, column: 28 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 11, column: 0 },
              end: { line: 11, column: 5 }
            },
            raw: 'ports',
            value: ['ports']
          },
          equals: 6,
          value: {
            type: 'inlinearray',
            loc: {
              start: { line: 11, column: 8 },
              end: { line: 11, column: 28 }
            },
            items: [
              {
                type: 'inlinearrayitem',
                loc: {
                  start: { line: 11, column: 10 },
                  end: { line: 11, column: 14 }
                },
                item: {
                  type: 'integer',
                  loc: {
                    start: { line: 11, column: 10 },
                    end: { line: 11, column: 14 }
                  },
                  raw: '8001',
                  value: 8001
                },
                comma: true
              },
              {
                type: 'inlinearrayitem',
                loc: {
                  start: { line: 11, column: 16 },
                  end: { line: 11, column: 20 }
                },
                item: {
                  type: 'integer',
                  loc: {
                    start: { line: 11, column: 16 },
                    end: { line: 11, column: 20 }
                  },
                  raw: '8001',
                  value: 8001
                },
                comma: true
              },
              {
                type: 'inlinearrayitem',
                loc: {
                  start: { line: 11, column: 22 },
                  end: { line: 11, column: 26 }
                },
                item: {
                  type: 'integer',
                  loc: {
                    start: { line: 11, column: 22 },
                    end: { line: 11, column: 26 }
                  },
                  raw: '8002',
                  value: 8002
                },
                comma: false
              }
            ]
          },
          comments: null
        },
        {
          type: 'keyvalue',
          loc: {
            start: { line: 12, column: 0 },
            end: { line: 12, column: 21 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 12, column: 0 },
              end: { line: 12, column: 14 }
            },
            raw: 'connection_max',
            value: ['connection_max']
          },
          equals: 15,
          value: {
            type: 'integer',
            loc: {
              start: { line: 12, column: 17 },
              end: { line: 12, column: 21 }
            },
            raw: '5000',
            value: 5000
          },
          comments: null
        },
        {
          type: 'keyvalue',
          loc: {
            start: { line: 13, column: 0 },
            end: { line: 13, column: 14 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 13, column: 0 },
              end: { line: 13, column: 7 }
            },
            raw: 'enabled',
            value: ['enabled']
          },
          equals: 8,
          value: {
            type: 'boolean',
            loc: {
              start: { line: 13, column: 10 },
              end: { line: 13, column: 14 }
            },
            value: true
          },
          comments: null
        }
      ]
    },
    {
      type: 'table',
      loc: {
        start: { line: 15, column: 0 },
        end: { line: 24, column: 15 }
      },
      key: {
        type: 'tablekey',
        loc: {
          start: { line: 15, column: 0 },
          end: { line: 15, column: 9 }
        },
        value: {
          type: 'key',
          loc: {
            start: { line: 15, column: 1 },
            end: { line: 15, column: 8 }
          },
          raw: 'servers',
          value: ['server']
        },
        comment: null
      },
      items: [
        {
          type: 'comment',
          loc: {
            start: { line: 17, column: 2 },
            end: { line: 17, column: 64 }
          },
          raw: '# Indentation (tabs and/or spaces) is allowed but not required'
        },
        {
          type: 'table',
          loc: {
            start: { line: 18, column: 2 },
            end: { line: 20, column: 15 }
          },
          key: {
            type: 'tablekey',
            loc: {
              start: { line: 18, column: 2 },
              end: { line: 18, column: 17 }
            },
            value: {
              type: 'key',
              loc: {
                start: { line: 18, column: 3 },
                end: { line: 18, column: 16 }
              },
              raw: 'servers.alpha',
              value: ['servers', 'alpha']
            },
            comment: null
          },
          items: [
            {
              type: 'keyvalue',
              loc: {
                start: { line: 19, column: 2 },
                end: { line: 19, column: 17 }
              },
              key: {
                type: 'key',
                loc: {
                  start: { line: 19, column: 2 },
                  end: { line: 19, column: 4 }
                },
                raw: 'ip',
                value: ['ip']
              },
              equals: 5,
              value: {
                type: 'string',
                loc: {
                  start: { line: 19, column: 6 },
                  end: { line: 19, column: 17 }
                },
                raw: `"10.0.0.1"`,
                value: '10.0.0.1'
              },
              comments: null
            },
            {
              type: 'keyvalue',
              loc: {
                start: { line: 20, column: 2 },
                end: { line: 20, column: 15 }
              },
              key: {
                type: 'key',
                loc: {
                  start: { line: 20, column: 2 },
                  end: { line: 20, column: 4 }
                },
                raw: 'dc',
                value: ['dc']
              },
              equals: 5,
              value: {
                type: 'string',
                loc: {
                  start: { line: 20, column: 7 },
                  end: { line: 20, column: 15 }
                },
                raw: `"eqdc10"`,
                value: 'eqdc10'
              },
              comments: null
            }
          ]
        },
        {
          type: 'table',
          loc: {
            start: { line: 22, column: 2 },
            end: { line: 24, column: 15 }
          },
          key: {
            type: 'tablekey',
            loc: {
              start: { line: 22, column: 2 },
              end: { line: 22, column: 16 }
            },
            value: {
              type: 'key',
              loc: {
                start: { line: 22, column: 3 },
                end: { line: 22, column: 15 }
              },
              raw: 'servers.beta',
              value: ['servers', 'beta']
            },
            comment: null
          },
          items: [
            {
              type: 'keyvalue',
              loc: {
                start: { line: 23, column: 2 },
                end: { line: 23, column: 17 }
              },
              key: {
                type: 'key',
                loc: {
                  start: { line: 23, column: 2 },
                  end: { line: 23, column: 4 }
                },
                raw: 'ip',
                value: ['ip']
              },
              equals: 5,
              value: {
                type: 'string',
                loc: {
                  start: { line: 23, column: 6 },
                  end: { line: 23, column: 17 }
                },
                raw: `"10.0.0.2"`,
                value: '10.0.0.2'
              },
              comments: null
            },
            {
              type: 'keyvalue',
              loc: {
                start: { line: 24, column: 2 },
                end: { line: 24, column: 15 }
              },
              key: {
                type: 'key',
                loc: {
                  start: { line: 24, column: 2 },
                  end: { line: 24, column: 4 }
                },
                raw: 'dc',
                value: ['dc']
              },
              equals: 5,
              value: {
                type: 'string',
                loc: {
                  start: { line: 24, column: 7 },
                  end: { line: 24, column: 15 }
                },
                raw: `"eqdc10"`,
                value: 'eqdc10'
              },
              comments: null
            }
          ]
        }
      ]
    },
    {
      type: 'table',
      loc: {
        start: { line: 26, column: 0 },
        end: { line: 33, column: 1 }
      },
      key: {
        type: 'tablekey',
        loc: {
          start: { line: 26, column: 0 },
          end: { line: 26, column: 9 }
        },
        value: {
          type: 'key',
          loc: {
            start: { line: 26, column: 1 },
            end: { line: 26, column: 8 }
          },
          raw: 'clients',
          value: ['clients']
        },
        comment: null
      },
      items: [
        {
          type: 'keyvalue',
          loc: {
            start: { line: 27, column: 0 },
            end: { line: 27, column: 37 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 27, column: 0 },
              end: { line: 27, column: 4 }
            },
            raw: 'data',
            value: ['data']
          },
          equals: 5,
          value: {
            type: 'inlinearray',
            loc: {
              start: { line: 27, column: 7 },
              end: { line: 27, column: 37 }
            },
            items: [
              {
                type: 'inlinearrayitem',
                loc: {
                  start: { line: 27, column: 9 },
                  end: { line: 27, column: 27 }
                },
                item: {
                  type: 'inlinearray',
                  loc: {
                    start: { line: 27, column: 9 },
                    end: { line: 27, column: 27 }
                  },
                  items: [
                    {
                      type: 'inlinearrayitem',
                      loc: {
                        start: { line: 27, column: 10 },
                        end: { line: 27, column: 17 }
                      },
                      item: {
                        type: 'string',
                        loc: {
                          start: { line: 27, column: 10 },
                          end: { line: 27, column: 17 }
                        },
                        raw: `"gamma"`,
                        value: 'gamma'
                      },
                      comma: true
                    },
                    {
                      type: 'inlinearrayitem',
                      loc: {
                        start: { line: 27, column: 19 },
                        end: { line: 27, column: 26 }
                      },
                      item: {
                        type: 'string',
                        loc: {
                          start: { line: 27, column: 19 },
                          end: { line: 27, column: 26 }
                        },
                        raw: `"delta"`,
                        value: 'delta'
                      },
                      comma: false
                    }
                  ]
                },
                comma: true
              },
              {
                type: 'inlinearrayitem',
                loc: {
                  start: { line: 27, column: 29 },
                  end: { line: 27, column: 35 }
                },
                item: {
                  type: 'inlinearray',
                  loc: {
                    start: { line: 27, column: 29 },
                    end: { line: 27, column: 35 }
                  },
                  items: [
                    {
                      type: 'inlinearrayitem',
                      loc: {
                        start: { line: 27, column: 30 },
                        end: { line: 27, column: 31 }
                      },
                      item: {
                        type: 'integer',
                        loc: {
                          start: { line: 27, column: 30 },
                          end: { line: 27, column: 31 }
                        },
                        raw: '1',
                        value: 1
                      },
                      comma: true
                    },
                    {
                      type: 'inlinearrayitem',
                      loc: {
                        start: { line: 27, column: 33 },
                        end: { line: 27, column: 34 }
                      },
                      item: {
                        type: 'integer',
                        loc: {
                          start: { line: 27, column: 33 },
                          end: { line: 27, column: 34 }
                        },
                        raw: '2',
                        value: 2
                      },
                      comma: false
                    }
                  ]
                },
                comma: false
              }
            ]
          },
          comments: null
        },
        {
          type: 'comment',
          loc: {
            start: { line: 29, column: 0 },
            end: { line: 29, column: 39 }
          },
          raw: '# Line breaks are OK when inside arrays'
        },
        {
          type: 'keyvalue',
          loc: {
            start: { line: 30, column: 0 },
            end: { line: 33, column: 1 }
          },
          key: {
            type: 'key',
            loc: {
              start: { line: 30, column: 0 },
              end: { line: 30, column: 5 }
            },
            raw: 'hosts',
            value: ['hosts']
          },
          equals: 6,
          value: {
            type: 'inlinearray',
            loc: {
              start: { line: 30, column: 8 },
              end: { line: 33, column: 1 }
            },
            items: [
              {
                type: 'inlinearrayitem',
                loc: {
                  start: { line: 31, column: 2 },
                  end: { line: 31, column: 9 }
                },
                item: {
                  type: 'string',
                  loc: {
                    start: { line: 31, column: 2 },
                    end: { line: 31, column: 9 }
                  },
                  raw: `"alpha"`,
                  value: 'alpha'
                },
                comma: true
              },
              {
                type: 'inlinearrayitem',
                loc: {
                  start: { line: 32, column: 2 },
                  end: { line: 32, column: 9 }
                },
                item: {
                  type: 'string',
                  loc: {
                    start: { line: 32, column: 2 },
                    end: { line: 32, column: 9 }
                  },
                  raw: `"omega"`,
                  value: 'omega'
                },
                comma: true
              }
            ]
          },
          comments: null
        }
      ]
    }
  ]
};
